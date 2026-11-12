import { NextResponse } from 'next/server';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { notFound, validationError } from '@/lib/http/errors';
import { deleteComment, patchComment } from '@/lib/collaboration/service';
import { commentPatchSchema, objectIdString } from '@/lib/validation/collaboration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { id: string };

function parsedId(id: string): string {
  const parsed = objectIdString.safeParse(id);
  if (!parsed.success) throw notFound('Comment');
  return parsed.data;
}

export const PATCH = withAdmin<Params>(async (req, { params, site, user }) => {
  const id = parsedId((await params).id);
  const parsed = commentPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid comment update');
  const comment = await patchComment({
    siteId: site.id,
    id,
    user,
    body: parsed.data.body,
    resolved: parsed.data.resolved,
  });
  return NextResponse.json(comment, { headers: { 'Cache-Control': 'no-store' } });
});

export const DELETE = withAdmin<Params>(async (_req, { params, site, user }) => {
  const id = parsedId((await params).id);
  const result = await deleteComment({ siteId: site.id, id, user });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
});
