import { z } from 'zod';
import {
  optionalTextSchema,
  optionalUrlSchema,
  publicationStatusSchema,
  requiredTextSchema,
  slugSchema,
} from './common';

export const authorInputSchema = z
  .object({
    name: requiredTextSchema,
    slug: slugSchema,
    role: optionalTextSchema,
    bio: optionalTextSchema,
    avatarUrl: optionalUrlSchema,
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
