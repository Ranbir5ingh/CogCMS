import { z } from 'zod';
import { dataEnvelopeSchema, isoDateSchema, listEnvelopeSchema } from './common';

export const eventViewSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    content: z.string(),
    imageUrl: z.string(),
    imageAlt: z.string(),
    startAt: isoDateSchema,
    endAt: isoDateSchema,
    timeZone: z.string(),
    format: z.enum(['online', 'in-person', 'hybrid']),
    location: z.string(),
    onlineUrl: z.string(),
    registrationUrl: z.string(),
    ticketPriceType: z.enum(['free', 'paid']).optional(),
    ticketPriceAmount: z.string().optional(),
    ticketPriceCurrency: z.string().optional(),
    organizer: z.string(),
    speakers: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    updatedAt: isoDateSchema,
  })
  .strict();
export type EventView = z.infer<typeof eventViewSchema>;
export const eventResponseSchema = dataEnvelopeSchema(eventViewSchema);
export const eventListResponseSchema = listEnvelopeSchema(eventViewSchema);
