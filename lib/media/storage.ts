import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildS3PublicUrl, createMediaClient, getS3Config, isS3Configured } from '@/lib/aws-s3';
import { HttpError, validationError } from '@/lib/http/errors';
import { assertSafeMediaKey } from '@/lib/media/keys';
import { MEDIA_PUBLIC_PATH, mediaPublicOrigin } from '@/lib/media/public-url';
export { mediaPublicOrigin } from '@/lib/media/public-url';

const STORAGE_TIMEOUT_MS = 15_000;

export interface MediaStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export function mediaRoot(): string {
  const override = process.env.MEDIA_ROOT?.trim();
  if (override) return path.resolve(override);
  return path.resolve(process.cwd(), 'data', 'media');
}

function resolvedPath(root: string, key: string): string {
  const safe = assertSafeMediaKey(key);
  const full = path.resolve(root, safe);
  const rootWithSep = path.resolve(root) + path.sep;
  if (full !== path.resolve(root) && !full.startsWith(rootWithSep)) {
    throw validationError(null, 'Invalid media key');
  }
  return full;
}

export class LocalDiskStorage implements MediaStorage {
  constructor(private readonly root = mediaRoot()) {}

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const full = resolvedPath(this.root, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async get(key: string): Promise<Buffer | null> {
    const full = resolvedPath(this.root, key);
    try {
      return await readFile(full);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const full = resolvedPath(this.root, key);
    await rm(full, { force: true });
  }

  publicUrl(key: string): string {
    const safe = assertSafeMediaKey(key);
    return `${mediaPublicOrigin()}${MEDIA_PUBLIC_PATH}/${safe}`;
  }
}

async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Storage operation timed out'));
        }, STORAGE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class S3MediaStorage implements MediaStorage {
  publicUrl(key: string): string {
    const config = getS3Config();
    if (!config) throw new HttpError(500, 'INTERNAL_ERROR', 'AWS S3 is not configured');
    return buildS3PublicUrl(config.publicUrl, assertSafeMediaKey(key));
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const config = getS3Config();
    if (!config) throw new HttpError(500, 'INTERNAL_ERROR', 'AWS S3 is not configured');
    const client = createMediaClient(config);
    await bounded((signal) =>
      client.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: assertSafeMediaKey(key),
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
        { abortSignal: signal },
      ),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    const config = getS3Config();
    if (!config) throw new HttpError(500, 'INTERNAL_ERROR', 'AWS S3 is not configured');
    const client = createMediaClient(config);
    try {
      const object = await bounded((signal) =>
        client.send(
          new GetObjectCommand({ Bucket: config.bucketName, Key: assertSafeMediaKey(key) }),
          { abortSignal: signal },
        ),
      );
      const body = object.Body;
      if (!(body instanceof Readable)) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404 || (error as { name?: string }).name === 'NoSuchKey') return null;
      throw new HttpError(500, 'INTERNAL_ERROR', 'Unable to read stored image');
    }
  }

  async delete(key: string): Promise<void> {
    const config = getS3Config();
    if (!config) throw new HttpError(500, 'INTERNAL_ERROR', 'AWS S3 is not configured');
    const client = createMediaClient(config);
    try {
      await bounded((signal) =>
        client.send(
          new DeleteObjectCommand({ Bucket: config.bucketName, Key: assertSafeMediaKey(key) }),
          { abortSignal: signal },
        ),
      );
    } catch {
      /* Missing objects are already gone. */
    }
  }
}

/** Local disk unless a complete S3 configuration is present. */
export function getMediaStorage(): MediaStorage {
  if (isS3Configured()) return new S3MediaStorage();
  return new LocalDiskStorage();
}
