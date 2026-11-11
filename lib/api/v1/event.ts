import type { EventView } from '@/contracts/v1/event';

export function serializeEvent(event: any): EventView {
  return {
    id: event._id.toString(),
    title: event.title,
    slug: event.slug,
    summary: event.summary,
    content: event.content,
    imageUrl: event.imageUrl,
    imageAlt: event.imageAlt,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    timeZone: event.timeZone,
    format: event.format,
    location: event.location,
    onlineUrl: event.onlineUrl,
    registrationUrl: event.registrationUrl,
    ...(event.ticketPriceType && {
      ticketPriceType: event.ticketPriceType,
      ticketPriceAmount: event.ticketPriceAmount ?? '',
      ticketPriceCurrency: event.ticketPriceCurrency ?? '',
    }),
    organizer: event.organizer,
    speakers: event.speakers,
    metaTitle: event.metaTitle,
    metaDescription: event.metaDescription,
    updatedAt: event.updatedAt.toISOString(),
  };
}
