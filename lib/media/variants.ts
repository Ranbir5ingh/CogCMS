import sharp from 'sharp';
import { validationError } from '@/lib/http/errors';
import { buildOriginalKey, buildVariantKey } from '@/lib/media/keys';
import type { MediaStorage } from '@/lib/media/storage';
import type { ImageMimeType } from '@/lib/media/magic';
import type { MediaSizeName, MediaSizes, MediaVariant } from '@/models/Media';

export const VARIANT_MAX: Record<Exclude<MediaSizeName, 'original'>, number> = {
  thumbnail: 320,
  medium: 768,
  large: 1280,
};

export interface GeneratedVariant {
  name: MediaSizeName;
  bytes: Buffer;
  width: number;
  height: number;
  mimeType: string;
}

/** Frame height: animated inputs report stacked height when decoded with `animated: true`. */
async function originalDimensions(
  bytes: Buffer,
): Promise<{ width: number; height: number; pages: number }> {
  const decoder = sharp(bytes, {
    failOn: 'warning',
    unlimited: false,
    limitInputPixels: 16_000_000,
  });
  try {
    const metadata = await decoder.metadata();
    const width = metadata.width ?? 0;
    const pages = metadata.pages ?? 1;
    const rawHeight = metadata.height ?? 0;
    // Without `animated: true`, height is one frame. Guard the stacked case anyway.
    const height =
      pages > 1 && rawHeight >= pages && rawHeight % pages === 0 ? rawHeight / pages : rawHeight;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
      throw new Error('invalid dimensions');
    }
    return { width, height, pages };
  } catch {
    throw validationError(null, 'Image is invalid, unsupported, or exceeds the decoding limits');
  } finally {
    decoder.destroy();
  }
}

async function encodeWebp(
  bytes: Buffer,
  maxEdge: number,
): Promise<{ bytes: Buffer; width: number; height: number }> {
  // `pages: 1` keeps the first frame of an animation; originals stay untouched.
  const pipeline = sharp(bytes, {
    failOn: 'warning',
    unlimited: false,
    limitInputPixels: 16_000_000,
    pages: 1,
  })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 });
  try {
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  } finally {
    pipeline.destroy();
  }
}

export async function planVariants(
  bytes: Buffer,
  mimeType: ImageMimeType,
): Promise<{ width: number; height: number; generated: GeneratedVariant[] }> {
  const { width, height } = await originalDimensions(bytes);
  const generated: GeneratedVariant[] = [{ name: 'original', bytes, width, height, mimeType }];
  let lastDerivative: GeneratedVariant | null = null;
  for (const name of ['thumbnail', 'medium', 'large'] as const) {
    const encoded = await encodeWebp(bytes, VARIANT_MAX[name]);
    // Identical dimensions to a previous derivative would be a duplicate file; skip.
    if (
      lastDerivative &&
      lastDerivative.width === encoded.width &&
      lastDerivative.height === encoded.height
    ) {
      continue;
    }
    const variant: GeneratedVariant = {
      name,
      bytes: encoded.bytes,
      width: encoded.width,
      height: encoded.height,
      mimeType: 'image/webp',
    };
    generated.push(variant);
    lastDerivative = variant;
  }
  return { width, height, generated };
}

function toVariant(
  storage: MediaStorage,
  key: string,
  part: { bytes: Buffer; width: number; height: number; mimeType: string },
): MediaVariant {
  return {
    key,
    url: storage.publicUrl(key),
    width: part.width,
    height: part.height,
    bytes: part.bytes.length,
    mimeType: part.mimeType,
  };
}

/** Write the original and unique derivatives; alias a skipped size at the next-smaller file. */
export async function storeVariants(
  storage: MediaStorage,
  prefix: string,
  mimeType: ImageMimeType,
  bytes: Buffer,
): Promise<{ width: number; height: number; sizes: MediaSizes; writtenKeys: string[] }> {
  const planned = await planVariants(bytes, mimeType);
  const originalKey = buildOriginalKey(prefix, mimeType);
  const writtenKeys: string[] = [];
  const byName = new Map(planned.generated.map((item) => [item.name, item]));

  const original = byName.get('original')!;
  await storage.put(originalKey, original.bytes, original.mimeType);
  writtenKeys.push(originalKey);
  const sizes = { original: toVariant(storage, originalKey, original) } as MediaSizes;

  let previous: MediaVariant = sizes.original;
  for (const name of ['thumbnail', 'medium', 'large'] as const) {
    const generated = byName.get(name);
    if (generated) {
      const key = buildVariantKey(originalKey, name);
      await storage.put(key, generated.bytes, generated.mimeType);
      writtenKeys.push(key);
      sizes[name] = toVariant(storage, key, generated);
      previous = sizes[name];
    } else {
      sizes[name] = previous;
    }
  }

  return { width: planned.width, height: planned.height, sizes, writtenKeys };
}
