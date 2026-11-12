import { z } from 'zod';
import {
  optionalTextSchema,
  publicationStatusSchema,
  requiredTextSchema,
  slugSchema,
} from './common';
import { optionalMediaUrlSchema } from '@/lib/validation/media';

export const authorInputSchema = z
  .object({
    name: requiredTextSchema,
    slug: slugSchema,
    role: optionalTextSchema,
    bio: optionalTextSchema,
    avatarUrl: optionalMediaUrlSchema,
    socials: z
      .object({
        x: optionalTextSchema,
        linkedin: optionalTextSchema,
        website: optionalTextSchema,
      })
      .strip()
      .optional(),
    status: publicationStatusSchema.optional(),
  })
  .strip();

export type AuthorInput = z.infer<typeof authorInputSchema>;
export const authorUpdateSchema = authorInputSchema.partial();
