import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Event from '@/models/Event';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { validationError } from '@/lib/http/errors';
import { eventInputSchema } from '@/lib/validation/event';
import { sanitizeBlogHtml } from '@/lib/sanitize-blog-html';
import { notifySiteWebhook } from '@/lib/webhook';

export const dynamic = 'force-dynamic';
export const GET = withAdmin(async (_req, { site }) => {
  await connectToDatabase();
  return NextResponse.json(
    await Event.find({ siteId: site.id }).sort({ startAt: 1, _id: 1 }).exec(),
  );
});
export const POST = withAdmin(async (req, { site, user }) => {
  const parsed = eventInputSchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid event');
  await connectToDatabase();
  const event = await Event.create({
    ...parsed.data,
    content: sanitizeBlogHtml(parsed.data.content),
    siteId: site.id,
    publishedAt: parsed.data.status === 'publish' ? new Date() : null,
    createdBy: user.id,
    updatedBy: user.id,
  });
  if (event.status === 'publish')
    notifySiteWebhook(site.id, {
      type: 'content.published',
      contentType: 'event',
      slug: event.slug,
      id: event.id,
    });
  return NextResponse.json(event, { status: 201 });
});
