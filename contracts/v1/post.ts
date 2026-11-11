import { z } from 'zod';
import { authorViewSchema } from '@/contracts/v1/author';
import { dataEnvelopeSchema, isoDateSchema, listEnvelopeSchema } from '@/contracts/v1/common';

export const postSummarySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    excerpt: z.string(),
    imageUrl: z.string(),
    imageAlt: z.string(),
    tag: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    isFeatured: z.boolean(),
    publishedAt: isoDateSchema.nullable(),
    updatedAt: isoDateSchema,
    author: authorViewSchema.nullable().optional(),
  })
  .strict();
export const postSlugSchema = z.object({ slug: z.string(), updatedAt: isoDateSchema }).strict();
export const postCardSchema = postSummarySchema.omit({ author: true });
const tocEntrySchema = z
  .object({ id: z.string(), text: z.string(), level: z.number().int() })
  .strict();
export const postFullSchema = postSummarySchema
  .extend({
    renderedHtml: z.string(),
    toc: z.array(tocEntrySchema),
    readingTime: z
      .object({ minutes: z.number().nonnegative(), words: z.number().int().nonnegative() })
      .strict(),
    faqs: z.array(z.object({ question: z.string(), answer: z.string() }).strict()),
    keyTakeaways: z.array(z.string()),
    metaTitle: z.string(),
    metaDescription: z.string(),
    keywords: z.array(z.string()),
    related: z.array(postCardSchema).max(3).optional(),
    jsonLd: z
      .object({
        article: z.record(z.string(), z.unknown()),
        faq: z.record(z.string(), z.unknown()).nullable(),
        breadcrumb: z.record(z.string(), z.unknown()),
      })
      .strict()
      .optional(),
    urls: z.object({ canonical: z.string() }).strict(),
    content: z.string().optional(),
  })
  .strict();
export const postResponseSchema = dataEnvelopeSchema(postFullSchema);
export const postListResponseSchema = listEnvelopeSchema(
  z.union([postSummarySchema, postSlugSchema]),
);
export type PostSummary = z.infer<typeof postSummarySchema>;
export type PostFull = z.infer<typeof postFullSchema>;
