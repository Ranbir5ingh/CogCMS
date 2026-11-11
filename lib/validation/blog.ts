import { z } from 'zod';
import { slugSchema } from './common';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid author id');

export const blogInputSchema = z
  .object({
    title: z.string().min(1),
    slug: slugSchema,
    content: z.string().min(1),
    excerpt: z.string().optional(),
    imageUrl: z.string().optional(),
    imageAlt: z.string().max(300).optional(),
    tag: z.string().optional(),
    status: z.enum(['draft', 'publish']).optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    keywords: z.string().optional(),
    isFeatured: z.boolean().optional(),
    createdAt: z.string().optional(),
    authorId: objectIdSchema.nullable().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    faqs: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).optional(),
    keyTakeaways: z.array(z.string().min(1)).optional(),
    relatedSlugs: z.array(z.string()).optional(),
    tocOverrides: z
      .array(
        z.object({
          id: z.string(),
          label: z.string().optional(),
          hidden: z.boolean().optional(),
        }),
      )
      .optional(),
  })
  .strip();

export type BlogInput = z.infer<typeof blogInputSchema>;
