import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import FAQ from '@/models/FAQ';
import { faqUpdateSchema } from '@/lib/validation/faq';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { notFound, validationError } from '@/lib/http/errors';
import { deliveryEventType, notifySiteWebhook } from '@/lib/webhook';

export const dynamic = 'force-dynamic';
type Params = { id: string };

function validId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

function faqUpdate(raw: unknown): Record<string, unknown> {
  const parsed = faqUpdateSchema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid FAQ payload');
  return parsed.data;
}

export const GET = withAdmin<Params>(async (_req, { params, site }) => {
  const { id } = await params;
  if (!validId(id)) throw notFound('FAQ');
  await connectToDatabase();
  const faq = await FAQ.findOne({ _id: id, siteId: site.id }).exec();
  if (!faq) throw notFound('FAQ');
  return NextResponse.json(faq);
});

export const PUT = withAdmin<Params>(async (req, { params, user, site }) => {
  const { id } = await params;
  if (!validId(id)) throw notFound('FAQ');
  const update = faqUpdate(await readJson(req));
  await connectToDatabase();
  const existing = await FAQ.findOne({ _id: id, siteId: site.id }).exec();
  if (!existing) throw notFound('FAQ');
  update.updatedBy = user.id;
  if (update.status === 'publish' && !existing.publishedAt) update.publishedAt = new Date();
  const faq = await FAQ.findOneAndUpdate(
    { _id: id, siteId: site.id },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  ).exec();
  if (!faq) throw notFound('FAQ');
  const eventType = deliveryEventType(existing.status, faq.status);
  if (eventType) {
    notifySiteWebhook(site.id, {
      type: eventType,
      contentType: 'faq',
      slug: faq._id.toString(),
      id: faq._id.toString(),
    });
  }
  return NextResponse.json(faq);
});

export const DELETE = withAdmin<Params>(async (_req, { params, site }) => {
  const { id } = await params;
  if (!validId(id)) throw notFound('FAQ');
  await connectToDatabase();
  const faq = await FAQ.findOneAndDelete({ _id: id, siteId: site.id }).exec();
  if (!faq) throw notFound('FAQ');
  if (faq.status === 'publish') {
    notifySiteWebhook(site.id, {
      type: 'content.deleted',
      contentType: 'faq',
      slug: faq._id.toString(),
      id: faq._id.toString(),
    });
  }
  return NextResponse.json({ message: 'Deleted successfully' });
});
