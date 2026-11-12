import { NextResponse } from 'next/server';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { validationError } from '@/lib/http/errors';
import { addComment, listComments } from '@/lib/collaboration/service';
import { commentCreateSchema, resourceQuerySchema } from '@/lib/validation/collaboration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAdmin(async (req, { site }) => {
  const parsed = resourceQuerySchema.safeParse({
    resourceType: req.nextUrl.searchParams.get('resourceType') ?? undefined,
    resourceId: req.nextUrl.searchParams.get('resourceId') ?? undefined,
  });
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid comment query');
  const comments = await listComments(site.id, parsed.data.resourceType, parsed.data.resourceId);
  return NextResponse.json({ data: comments }, { headers: { 'Cache-Control': 'no-store' } });
});

export const POST = withAdmin(async (req, { site, user }) => {
  const parsed = commentCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid comment');
  const comment = await addComment({
    siteId: site.id,
    user,
    resourceType: parsed.data.resourceType,
    resourceId: parsed.data.resourceId,
    body: parsed.data.body,
    field: parsed.data.field,
  });
  return NextResponse.json(comment, { status: 201, headers: { 'Cache-Control': 'no-store' } });
});
