import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/require';
import { assertKnownQuery } from '@/lib/http/api-query';
import { withAdmin, type RouteContext } from '@/lib/http/admin-handler';
import { MAX_MEDIA_BYTES } from '@/lib/aws-s3';
import { toErrorResponse, validationError } from '@/lib/http/errors';
import { createMediaAsset, listMediaAssets } from '@/lib/media/service';
import { resolveSite } from '@/lib/site/context';
import { mediaAltSchema } from '@/lib/validation/media';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const LIST_QUERY = ['page', 'limit', 'search'] as const;

export const GET = withAdmin(async (req, { site }) => {
  const searchParams = req.nextUrl.searchParams;
  assertKnownQuery(searchParams, LIST_QUERY);
  const result = await listMediaAssets({ siteId: site.id, searchParams });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
});

/**
 * Authenticate before the multipart Content-Type check so an anonymous JSON
 * probe (the shared admin-route inventory) still receives 401, not 400.
 */
export async function POST(req: NextRequest, _ctx: RouteContext) {
  try {
    const user = await requireUser(req);
    assertSameOrigin(req, 'multipart');
    const site = await resolveSite(req, user);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw validationError(null, 'Expected a multipart image upload');
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw validationError(null, 'Choose an image to upload');
    }
    if (file.size > MAX_MEDIA_BYTES) {
      throw validationError(null, 'Choose a supported image between 1 byte and 10 MiB');
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const altValue = form.get('alt');
    const altParsed = mediaAltSchema.safeParse(typeof altValue === 'string' ? altValue : '');
    if (!altParsed.success) {
      throw validationError(altParsed.error.flatten(), 'Alt text must be at most 300 characters');
    }
    const media = await createMediaAsset({
      site,
      user,
      bytes,
      filename: file.name || 'image',
      declaredType: file.type,
      alt: altParsed.data,
    });
    return NextResponse.json(media, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
