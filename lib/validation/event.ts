import { z } from 'zod';
import {
  optionalUrlSchema,
  publicationStatusSchema,
  requiredSourceTextSchema,
  requiredTextSchema,
} from './common';

const date = z.string().datetime({ offset: true });
export const optionalEventUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
      );
    } catch {
      return false;
    }
  }, 'Must be a valid http(s) URL')
  .optional();
export const eventSlugSchema = z
  .string()
  .trim()
  .min(1, 'Enter a URL slug')
  .max(160, 'URL slug must be 160 characters or fewer')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');
export const eventInputSchema = z
  .object({
    title: requiredTextSchema.max(150),
    slug: eventSlugSchema,
    summary: z.string().max(3000).default(''),
    content: requiredSourceTextSchema,
    imageUrl: optionalUrlSchema,
    imageAlt: z.string().default(''),
    startAt: date,
    endAt: date,
    timeZone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Choose a valid time zone'),
    format: z.enum(['online', 'in-person', 'hybrid']),
    location: z.string().default(''),
    onlineUrl: optionalEventUrlSchema,
    registrationUrl: optionalEventUrlSchema,
    ticketPriceType: z.enum(['free', 'paid']).optional(),
    ticketPriceAmount: z.string().trim().optional(),
    ticketPriceCurrency: z.string().trim().optional(),
    organizer: z.string().default(''),
    speakers: z.string().default(''),
    metaTitle: z.string().default(''),
    metaDescription: z.string().default(''),
    status: publicationStatusSchema.default('draft'),
  })
  .superRefine((event, ctx) => {
    if (event.ticketPriceType === 'paid') {
      if (
        !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(event.ticketPriceAmount ?? '') ||
        Number(event.ticketPriceAmount) <= 0
      )
        ctx.addIssue({
          code: 'custom',
          path: ['ticketPriceAmount'],
          message: 'Enter a valid ticket price greater than zero',
        });
      if (!/^[A-Z]{3}$/.test(event.ticketPriceCurrency ?? ''))
        ctx.addIssue({
          code: 'custom',
          path: ['ticketPriceCurrency'],
          message: 'Enter a three-letter currency code, such as INR or USD',
        });
    } else if (event.ticketPriceAmount || event.ticketPriceCurrency) {
      ctx.addIssue({
        code: 'custom',
        path: ['ticketPriceType'],
        message: 'Choose paid tickets to set an amount and currency',
      });
    }
    if (Date.parse(event.endAt) <= Date.parse(event.startAt))
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'End must be after start' });
    if (event.format !== 'online' && !event.location.trim())
      ctx.addIssue({ code: 'custom', path: ['location'], message: 'Venue is required' });
    if (event.format !== 'in-person' && !event.onlineUrl)
      ctx.addIssue({
        code: 'custom',
        path: ['onlineUrl'],
        message: 'Online event URL is required',
      });
  });
