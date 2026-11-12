import { z } from 'zod';
import { isAllowedMediaUrl } from '@/lib/media/public-url';

export { isAllowedMediaUrl, isFirstPartyMediaUrl, mediaPublicOrigin } from '@/lib/media/public-url';

export const optionalMediaUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || isAllowedMediaUrl(value), 'Must be a valid http(s) URL')
  .optional();

export const mediaAltSchema = z.string().trim().max(300);
export const mediaPatchSchema = z.object({ alt: mediaAltSchema }).strict();
export const mediaIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid media id')
  .transform((value) => value.toLowerCase());
