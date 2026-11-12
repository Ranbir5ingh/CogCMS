import type { NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { forbidden, validationError } from '@/lib/http/errors';

export type AdminContentType = 'json' | 'multipart' | 'jsonOrText';

function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function requestHostOrigin(request: NextRequest): string {
  const host = request.headers.get('host') ?? request.nextUrl.host;
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(':', '');
  return `${protocol}://${host}`;
}

function assertContentType(request: NextRequest, expected: AdminContentType): void {
  const raw = request.headers.get('content-type') ?? '';
  const mediaType = raw.split(';', 1)[0]?.trim().toLowerCase();
  if (expected === 'jsonOrText') {
    if (mediaType !== 'application/json' && mediaType !== 'text/plain') {
      throw validationError(
        { contentType: raw || null },
        'Content-Type must be application/json or text/plain',
      );
    }
    return;
  }
  const required = expected === 'multipart' ? 'multipart/form-data' : 'application/json';
  if (mediaType !== required) {
    throw validationError({ contentType: raw || null }, `Content-Type must be ${required}`);
  }
}

/** Enforces origin and fetch metadata for mutations, then the selected body type. */
export function assertSameOrigin(
  request: NextRequest,
  contentType: AdminContentType = 'json',
): void {
  if (request.method === 'GET') return;

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') throw forbidden();

  const originHeader = request.headers.get('origin');
  const source = originHeader ?? request.headers.get('referer');
  const sourceOrigin = source ? originOf(source) : null;
  const envOrigin = getEnv().NEXT_PUBLIC_CMS_URL;
  const allowedOrigins = new Set([originOf(requestHostOrigin(request)), envOrigin].filter(Boolean));
  if (!sourceOrigin || !allowedOrigins.has(sourceOrigin)) throw forbidden();

  assertContentType(request, contentType);
}
