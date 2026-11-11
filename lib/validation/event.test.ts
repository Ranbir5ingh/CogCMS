import { describe, expect, it } from 'vitest';
import { eventInputSchema } from './event';

const event = {
  title: 'Community event',
  slug: 'community-event',
  content: '<p>Hello</p>',
  startAt: '2026-11-01T10:00:00.000Z',
  endAt: '2026-11-01T11:00:00.000Z',
  timeZone: 'Asia/Kolkata',
  format: 'online',
  onlineUrl: 'https://example.com/join',
};

describe('event validation', () => {
  it('validates free and paid ticket prices without requiring prices on older events', () => {
    expect(eventInputSchema.safeParse(event).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...event, ticketPriceType: 'unspecified' }).success).toBe(
      false,
    );
    expect(
      eventInputSchema.safeParse({
        ...event,
        ticketPriceType: 'free',
        ticketPriceAmount: '',
        ticketPriceCurrency: '',
      }).success,
    ).toBe(true);
    expect(
      eventInputSchema.safeParse({
        ...event,
        ticketPriceType: 'paid',
        ticketPriceAmount: '499.50',
        ticketPriceCurrency: 'INR',
      }).success,
    ).toBe(true);
    expect(
      eventInputSchema.safeParse({
        ...event,
        ticketPriceType: 'paid',
        ticketPriceAmount: '0',
        ticketPriceCurrency: 'INR',
      }).success,
    ).toBe(false);
    expect(
      eventInputSchema.safeParse({
        ...event,
        ticketPriceType: 'paid',
        ticketPriceAmount: '12.3456',
        ticketPriceCurrency: 'USD',
      }).success,
    ).toBe(false);
    expect(
      eventInputSchema.safeParse({
        ...event,
        ticketPriceType: 'paid',
        ticketPriceAmount: '10',
        ticketPriceCurrency: 'usd',
      }).success,
    ).toBe(false);
    expect(
      eventInputSchema.safeParse({
        ...event,
        ticketPriceType: 'free',
        ticketPriceAmount: '10',
        ticketPriceCurrency: 'USD',
      }).success,
    ).toBe(false);
  });
  it('accepts an online event', () => expect(eventInputSchema.safeParse(event).success).toBe(true));
  it('limits summary length on the server', () => {
    expect(eventInputSchema.safeParse({ ...event, summary: 'x'.repeat(3000) }).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...event, summary: 'x'.repeat(3001) }).success).toBe(false);
  });
  it('limits title length on the server', () => {
    expect(eventInputSchema.safeParse({ ...event, title: 'x'.repeat(150) }).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...event, title: 'x'.repeat(151) }).success).toBe(false);
  });
  it('rejects invalid slugs and event URLs', () => {
    const slug = eventInputSchema.safeParse({ ...event, slug: 'x'.repeat(161) });
    expect(slug.success).toBe(false);
    if (!slug.success)
      expect(slug.error.flatten().fieldErrors.slug).toContain(
        'URL slug must be 160 characters or fewer',
      );
    expect(eventInputSchema.safeParse({ ...event, slug: 'some text' }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...event, onlineUrl: 'not-a-url' }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...event, registrationUrl: 'not-a-url' }).success).toBe(
      false,
    );
    expect(
      eventInputSchema.safeParse({ ...event, registrationUrl: 'https://example.com/register' })
        .success,
    ).toBe(true);
  });
  it('rejects invalid schedules and time zones', () => {
    expect(eventInputSchema.safeParse({ ...event, endAt: event.startAt }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...event, timeZone: 'not/a-zone' }).success).toBe(false);
  });
  it('accepts local HTTP URLs for event and registration links', () => {
    expect(
      eventInputSchema.safeParse({
        ...event,
        onlineUrl: 'http://localhost:3003/admin/dashboard/events/new',
        registrationUrl: 'http://localhost:3003/register',
      }).success,
    ).toBe(true);
    expect(
      eventInputSchema.safeParse({ ...event, registrationUrl: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });
  it('requires the location appropriate to the format', () => {
    expect(eventInputSchema.safeParse({ ...event, onlineUrl: '' }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...event, format: 'hybrid', location: '' }).success).toBe(
      false,
    );
    expect(
      eventInputSchema.safeParse({ ...event, format: 'hybrid', location: 'Mumbai' }).success,
    ).toBe(true);
  });
});
