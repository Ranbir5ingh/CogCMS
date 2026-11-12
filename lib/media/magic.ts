import { validationError } from '@/lib/http/errors';

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

function isAvif(bytes: Buffer): boolean {
  if (bytes.length < 16 || bytes.toString('ascii', 4, 8) !== 'ftyp') return false;
  // Brands live in the ftyp box; accept the major brand or a compatible brand.
  const boxSize = bytes.readUInt32BE(0);
  const end = Math.min(bytes.length, Number.isSafeInteger(boxSize) && boxSize > 8 ? boxSize : 64);
  const brands = bytes.toString('ascii', 8, end);
  return brands.includes('avif') || brands.includes('avis');
}

/** Identify an image from its leading bytes, never from a client-supplied name or MIME. */
export function sniffImageMime(bytes: Buffer): ImageMimeType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  const head6 = bytes.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  if (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (isAvif(bytes)) return 'image/avif';
  return null;
}

export function isImageMimeType(value: string): value is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(value.toLowerCase());
}

/**
 * The sniffed type is authoritative. A declared MIME, if present and in the
 * supported set, must agree — otherwise a renamed `.jpg` that is actually a
 * GIF would slip past a naive Content-Type check.
 */
export function resolveImageMime(bytes: Buffer, declared?: string): ImageMimeType {
  const sniffed = sniffImageMime(bytes);
  if (!sniffed) {
    throw validationError(null, 'Choose a JPEG, PNG, WebP, GIF or AVIF image');
  }
  const normalized = declared?.toLowerCase().trim();
  if (normalized && isImageMimeType(normalized) && normalized !== sniffed) {
    throw validationError(null, 'File type does not match its contents');
  }
  return sniffed;
}
