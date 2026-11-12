import { NextResponse } from 'next/server';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { notFound, validationError } from '@/lib/http/errors';
import { deleteMediaAsset, getMediaAsset, updateMediaAlt } from '@/lib/media/service';
import { serializeMedia } from '@/lib/media/serialize';
import { mediaIdSchema, mediaPatchSchema } from '@/lib/validation/media';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { id: string };

function parsedId(id: string): string {
  const parsed = mediaIdSchema.safeParse(id);
  if (!parsed.success) throw notFound('Media');
  return parsed.data;
}

export const GET = withAdmin<Params>(async (_req, { params, site }) => {
  const id = parsedId((await params).id);
  const media = await getMediaAsset(site.id, id);
  return NextResponse.json(serializeMedia(media), { headers: { 'Cache-Control': 'no-store' } });
});

export const PATCH = withAdmin<Params>(async (req, { params, site, user }) => {
  const id = parsedId((await params).id);
  const parsed = mediaPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    throw validationError(parsed.error.flatten(), 'Invalid media payload');
  }
  const media = await updateMediaAlt({
    siteId: site.id,
    id,
    userId: user.id,
    alt: parsed.data.alt,
  });
  return NextResponse.json(media, { headers: { 'Cache-Control': 'no-store' } });
});

export const DELETE = withAdmin<Params>(async (req, { params, site }) => {
  const id = parsedId((await params).id);
  const force = req.nextUrl.searchParams.get('force') === 'true';
  const result = await deleteMediaAsset({ siteId: site.id, id, force });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
});
