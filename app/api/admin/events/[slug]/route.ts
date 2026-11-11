import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Event from '@/models/Event';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { notFound, validationError } from '@/lib/http/errors';
import { eventInputSchema } from '@/lib/validation/event';
import { sanitizeBlogHtml } from '@/lib/sanitize-blog-html';
import { deliveryEventType, notifySiteWebhook } from '@/lib/webhook';

export const dynamic = 'force-dynamic';
type Params = { slug: string };
export const GET = withAdmin<Params>(async (_req, { site, params }) => {
  await connectToDatabase();
  const event = await Event.findOne({ siteId: site.id, slug: (await params).slug });
  if (!event) throw notFound('Event');
  return NextResponse.json(event);
});
export const PUT = withAdmin<Params>(async (req, { site, user, params }) => {
  const parsed = eventInputSchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid event');
  await connectToDatabase();
  const event = await Event.findOne({ siteId: site.id, slug: (await params).slug });
  if (!event) throw notFound('Event');
  const before = event.status;
  const oldSlug = event.slug;
  event.set({ ...parsed.data, content: sanitizeBlogHtml(parsed.data.content), updatedBy: user.id });
  if (event.status === 'publish' && !event.publishedAt) event.publishedAt = new Date();
  await event.save();
  if (before === 'publish' && oldSlug !== event.slug) {
    notifySiteWebhook(site.id, { type: 'content.unpublished', contentType: 'event', slug: oldSlug, id: event.id });
  }
  const type = deliveryEventType(before, event.status);
  if (type)
    notifySiteWebhook(site.id, { type, contentType: 'event', slug: event.slug, id: event.id });
  return NextResponse.json(event);
});
export const DELETE = withAdmin<Params>(async (_req, { site, params }) => {
  await connectToDatabase();
  const event = await Event.findOneAndDelete({ siteId: site.id, slug: (await params).slug });
  if (!event) throw notFound('Event');
  if (event.status === 'publish')
    notifySiteWebhook(site.id, {
      type: 'content.deleted',
      contentType: 'event',
      slug: event.slug,
      id: event.id,
    });
  return NextResponse.json({ message: 'Deleted successfully' });
});
