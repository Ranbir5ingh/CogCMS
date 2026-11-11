import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Author from '@/models/Author';
import { authorUpdateSchema } from '@/lib/validation/author';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { notFound, validationError } from '@/lib/http/errors';
import { deliveryEventType, notifySiteWebhook } from '@/lib/webhook';
import { assertAuthorNotUsedByBlogs } from '@/lib/admin/author-policy';

export const dynamic = 'force-dynamic';
type Params = { slug: string };

export const GET = withAdmin<Params>(async (_req, { params, site }) => {
  const { slug } = await params;
  await connectToDatabase();
  const author = await Author.findOne({ slug, siteId: site.id }).exec();
  if (!author) throw notFound('Author');
  return NextResponse.json(author);
});

export const PUT = withAdmin<Params>(async (req, { params, user, site }) => {
  const { slug } = await params;
  const raw = await readJson(req);
  const parsed = authorUpdateSchema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid author payload');
  const { status, ...data } = parsed.data;

  await connectToDatabase();
  const existing = await Author.findOne({ slug, siteId: site.id }).exec();
  if (!existing) throw notFound('Author');
  if (status === 'draft' && existing.status === 'publish') {
    await assertAuthorNotUsedByBlogs(site.id, existing._id.toString(), 'published');
  }
  const update: Record<string, unknown> = { ...data, updatedBy: user.id };
  if (status !== undefined) update.status = status;
  if (status === 'publish' && !existing.publishedAt) update.publishedAt = new Date();
  const author = await Author.findOneAndUpdate(
    { _id: existing._id, siteId: site.id },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  ).exec();
  if (!author) throw notFound('Author');
  const eventType = deliveryEventType(existing.status, author.status);
  if (eventType) {
    notifySiteWebhook(site.id, {
      type: eventType,
      contentType: 'author',
      slug: author.slug,
      id: author._id.toString(),
    });
  }
  return NextResponse.json(author);
});

export const DELETE = withAdmin<Params>(async (_req, { params, site }) => {
  const { slug } = await params;
  await connectToDatabase();
  const existing = await Author.findOne({ slug, siteId: site.id }).exec();
  if (!existing) throw notFound('Author');
  await assertAuthorNotUsedByBlogs(site.id, existing._id.toString(), 'any');
  const author = await Author.findOneAndDelete({ _id: existing._id, siteId: site.id }).exec();
  if (!author) throw notFound('Author');
  if (author.status === 'publish') {
    notifySiteWebhook(site.id, {
      type: 'content.deleted',
      contentType: 'author',
      slug: author.slug,
      id: author._id.toString(),
    });
  }
  return NextResponse.json({ ok: true });
});
