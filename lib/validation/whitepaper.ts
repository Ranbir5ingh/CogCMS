import { z } from 'zod';
import {
  optionalTextSchema,
  publicationStatusSchema,
  requiredSourceTextSchema,
  requiredTextSchema,
  slugSchema,
} from './common';
import { optionalMediaUrlSchema } from '@/lib/validation/media';

const fields = {
  title: requiredTextSchema,
  slug: slugSchema,
  description: requiredTextSchema,
  date: optionalTextSchema,
  author: optionalTextSchema,
  authorRole: optionalTextSchema,
  readTime: optionalTextSchema,
  tags: z.array(z.string().trim().min(1)).optional(),
  headline: optionalTextSchema,
  stat1Value: optionalTextSchema,
  stat1Label: optionalTextSchema,
  stat2Value: optionalTextSchema,
  stat2Label: optionalTextSchema,
  excerpt: optionalTextSchema,
  content: requiredSourceTextSchema,
  imageUrl: optionalMediaUrlSchema,
  tag: optionalTextSchema,
  metaTitle: optionalTextSchema,
  metaDescription: optionalTextSchema,
  keywords: optionalTextSchema,
  isFeatured: z.boolean().optional(),
  status: publicationStatusSchema.optional(),
};

export const whitepaperInputSchema = z.object(fields).strip();
export const whitepaperUpdateSchema = z.object(fields).partial().strip();

export function estimateWhitepaperReadTime(content: string): string {
  const visible = content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*`\[\]_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = visible ? visible.split(' ').length : 0;
  return `${Math.max(1, Math.ceil(words / 238))} min read`;
}
