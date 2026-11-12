import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SAFE_MEDIA_KEY } from '@/lib/media/keys';
import { sniffImageMime } from '@/lib/media/magic';
import { getMediaStorage } from '@/lib/media/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

type Params = { key: string[] };

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const parts = (await ctx.params).key ?? [];
  const key = parts.map((part) => decodeURIComponent(part)).join('/');
  // Reject staging keys, traversal, and anything that is not a finalized library object.
  if (!SAFE_MEDIA_KEY.test(key)) return notFound();
  try {
    const body = await getMediaStorage().get(key);
    if (!body) return notFound();
    const sniffed = sniffImageMime(body);
    const extension = key.split('.').pop() ?? '';
    const contentType = sniffed ?? EXTENSION_MIME[extension] ?? 'application/octet-stream';
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return notFound();
  }
}
