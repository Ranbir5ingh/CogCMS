import crypto from 'node:crypto';
import path from 'node:path';
import { safeMediaPrefix, trustedImageExtension } from '@/lib/aws-s3';
import { validationError } from '@/lib/http/errors';
import type { MediaSizeName } from '@/models/Media';
export { SAFE_MEDIA_KEY, MEDIA_PUBLIC_PATH } from '@/lib/media/public-url';
import { SAFE_MEDIA_KEY } from '@/lib/media/public-url';

export function assertSafeMediaKey(key: string): string {
  if (typeof key !== 'string' || !SAFE_MEDIA_KEY.test(key)) {
    throw validationError(null, 'Invalid media key');
  }
  return key;
}

export function newMediaRandom(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** Original object key, following the same per-site, dated, unguessable shape as S3 uploads. */
export function buildOriginalKey(
  prefix: string,
  mimeType: string,
  now = new Date(),
  randomHex = newMediaRandom(),
): string {
  const extension = trustedImageExtension(mimeType);
  if (!extension) throw validationError(null, 'Unsupported image type');
  const date = now.toISOString().slice(0, 10);
  return `sites/${safeMediaPrefix(prefix)}/${date}/${randomHex}${extension}`;
}

export function buildVariantKey(
  originalKey: string,
  size: Exclude<MediaSizeName, 'original'>,
): string {
  const match = originalKey.match(
    /^(sites\/[a-z0-9_-]{1,80}\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{32})\.[a-z]+$/,
  );
  if (!match) throw validationError(null, 'Invalid media key');
  return `${match[1]}-${size}.webp`;
}

export function mediaTokenFromKey(key: string): string | null {
  const match = key.match(/\/([a-f0-9]{32})(?:-(?:thumbnail|medium|large))?\.[a-z]+$/);
  return match?.[1] ?? null;
}

export function safeOriginalName(name: string): string {
  const base = path.basename(name.normalize('NFKC').trim()).slice(0, 200);
  const cleaned = base
    .replace(/^[.]+/, '')
    .replace(/[^\w.\- ()[\]+',]+/gu, '_')
    .trim();
  return cleaned || 'image';
}
