import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Whitepaper from '@/models/Whitepaper';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { notFound, validationError } from '@/lib/http/errors';
import { estimateWhitepaperReadTime, whitepaperUpdateSchema } from '@/lib/validation/whitepaper';
import { deliveryEventType, notifySiteWebhook } from '@/lib/webhook';
import { assertEditable, assertFreshWrite, takeExpectedUpdatedAt } from '@/lib/collaboration/guard';

export const dynamic = 'force-dynamic';
type Params = { slug: string };

function updatePayload(raw: unknown): Record<string, unknown> {
  const parsed = whitepaperUpdateSchema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid whitepaper payload');
  return parsed.data;
}

export const GET = withAdmin<Params>(async (_req, { params, site }) => {
  const { slug } = await params;
  await connectToDatabase();
  const whitepaper = await Whitepaper.findOne({ slug, siteId: site.id }).exec();
  if (!whitepaper) throw notFound('Whitepaper');
  return NextResponse.json(whitepaper);
});

export const PUT = withAdmin<Params>(async (req, { params, user, site }) => {
  const { slug } = await params;
  const body = await readJson(req);
  const expectedUpdatedAt = takeExpectedUpdatedAt(body);
  const update = updatePayload(body);
  await connectToDatabase();
  const existing = await Whitepaper.findOne({ slug, siteId: site.id }).exec();
  if (!existing) throw notFound('Whitepaper');
  assertFreshWrite(existing.updatedAt, expectedUpdatedAt);
  await assertEditable(site.id, 'whitepaper', existing._id.toString(), user);
  if (update.readTime === '') {
    update.readTime = estimateWhitepaperReadTime(
      typeof update.content === 'string' ? update.content : existing.content,
    );
  }
  update.updatedBy = user.id;
  if (update.status === 'publish' && !existing.publishedAt) update.publishedAt = new Date();
  const whitepaper = await Whitepaper.findOneAndUpdate(
    { _id: existing._id, siteId: site.id },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  ).exec();
  if (!whitepaper) throw notFound('Whitepaper');
  const eventType = deliveryEventType(existing.status, whitepaper.status);
  if (eventType) {
    notifySiteWebhook(site.id, {
      type: eventType,
      contentType: 'whitepaper',
      slug: whitepaper.slug,
      id: whitepaper._id.toString(),
    });
  }
  return NextResponse.json(whitepaper);
});

export const DELETE = withAdmin<Params>(async (_req, { params, site }) => {
  const { slug } = await params;
  await connectToDatabase();
  const whitepaper = await Whitepaper.findOneAndDelete({ slug, siteId: site.id }).exec();
  if (!whitepaper) throw notFound('Whitepaper');
  if (whitepaper.status === 'publish') {
    notifySiteWebhook(site.id, {
      type: 'content.deleted',
      contentType: 'whitepaper',
      slug: whitepaper.slug,
      id: whitepaper._id.toString(),
    });
  }
  return NextResponse.json({ message: 'Deleted successfully' });
});
