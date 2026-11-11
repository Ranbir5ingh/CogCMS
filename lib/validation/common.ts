import { z } from 'zod';

export const publicationStatusSchema = z.enum(['draft', 'publish']);
export const requiredTextSchema = z.string().trim().min(1);
export const optionalTextSchema = z.string().trim().optional();
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase URL-safe slug');

const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

export function isPublicHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  return DOMAIN_PATTERN.test(parsed.hostname);
}

export const optionalUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || isPublicHttpUrl(value), 'Must be a valid http(s) URL')
  .optional();

/** Validate a non-blank source string without altering its bytes. */
export const requiredSourceTextSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank');
