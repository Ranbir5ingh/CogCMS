import { isPublicHttpUrl } from '@/lib/validation/common';

/** Finalized library objects only. Staging keys and traversal never match. */
export const SAFE_MEDIA_KEY =
  /^sites\/[a-z0-9_-]{1,80}\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{32}(?:-(?:thumbnail|medium|large))?\.(jpg|png|webp|gif|avif)$/;

export const MEDIA_PUBLIC_PATH = '/media';

export function mediaPublicOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_CMS_URL?.trim() || 'http://localhost:3003';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://localhost:3003';
  }
}

function mediaPathFrom(url: URL): string | null {
  const prefix = `${MEDIA_PUBLIC_PATH}/`;
  if (!url.pathname.startsWith(prefix)) return null;
  return url.pathname.slice(prefix.length);
}

/**
 * First-party library URLs: same origin as this CMS (or a relative /media/ path)
 * and a finalized, unguessable object key.
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
