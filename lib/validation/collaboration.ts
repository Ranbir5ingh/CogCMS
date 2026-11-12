import { z } from 'zod';
import { COLLAB_RESOURCE_TYPES, COMMENT_FIELDS } from '@/lib/collaboration/types';

export const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')
  .transform((value) => value.toLowerCase());

export const resourceQuerySchema = z
  .object({
    resourceType: z.enum(COLLAB_RESOURCE_TYPES),
    resourceId: objectIdString,
  })
  .strict();

export const lockActionSchema = z
  .object({
    resourceType: z.enum(COLLAB_RESOURCE_TYPES),
    resourceId: objectIdString,
    action: z.enum(['acquire', 'release', 'takeover']),
  })
  .strict();

export const heartbeatSchema = z
  .object({
    resourceType: z.enum(COLLAB_RESOURCE_TYPES),
    resourceId: objectIdString,
  })
  .strict();

export const commentCreateSchema = z
  .object({
    resourceType: z.enum(COLLAB_RESOURCE_TYPES),
    resourceId: objectIdString,
    body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
    field: z.enum(COMMENT_FIELDS).nullable().optional(),
  })
  .strict();

export const commentPatchSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    resolved: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.body !== undefined || value.resolved !== undefined, {
    message: 'Provide a body or a resolved flag',
  });
