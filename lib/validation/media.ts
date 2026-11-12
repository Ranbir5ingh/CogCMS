import { z } from 'zod';
import { isPublicHttpUrl } from '@/lib/validation/common';
import { SAFE_MEDIA_KEY, MEDIA_PUBLIC_PATH } from '@/lib/media/keys';
import { mediaPublicOrigin } from '@/lib/media/storage';

function mediaPathFrom(url: URL): string | null {
  const prefix = `${MEDIA_PUBLIC_PATH}/`;
  if (!url.pathname.startsWith(prefix)) return null;
  return url.pathname.slice(prefix.length);
}

/**
 * First-party library URLs: same origin as this CMS (or a relative /media/ path)
 * and a finalized, unguessable object key. Does not weaken isPublicHttpUrl, which
 * still guards author websites, publisher links and similar public fields.
 */
export function isFirstPartyMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = trimmed.startsWith('/')
      ? new URL(trimmed, `${mediaPublicOrigin()}/`)
      : new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
  const key = mediaPathFrom(parsed);
  if (!key || !SAFE_MEDIA_KEY.test(key)) return false;
  if (trimmed.startsWith(`${MEDIA_PUBLIC_PATH}/`)) return true;
  return parsed.origin === mediaPublicOrigin();
}

export function isAllowedMediaUrl(value: string): boolean {
  return isPublicHttpUrl(value) || isFirstPartyMediaUrl(value);
}

export const optionalMediaUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || isAllowedMediaUrl(value), 'Must be a valid http(s) URL')
  .optional();

export const mediaAltSchema = z.string().trim().max(300);
export const mediaPatchSchema = z.object({ alt: mediaAltSchema }).strict();
export const mediaIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid media id')
  .transform((value) => value.toLowerCase());
