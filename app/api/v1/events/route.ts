import Event from '@/models/Event';
import { eventListResponseSchema } from '@/contracts/v1/event';
import { paginationMeta } from '@/contracts/v1/common';
import { serializeEvent } from '@/lib/api/v1/event';
import { apiJson, publishedFilter, withApiKey } from '@/lib/http/api-handler';
import { assertKnownQuery, parsePagination } from '@/lib/http/api-query';

export const dynamic = 'force-dynamic';
export const GET = withApiKey('content:read', async (req, { auth }) => {
  assertKnownQuery(req.nextUrl.searchParams, ['page', 'limit']);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const filter = publishedFilter(auth.siteId);
  const [events, total] = await Promise.all([
    Event.find(filter).sort({ startAt: 1, _id: 1 }).skip(skip).limit(limit).exec(),
    Event.countDocuments(filter).exec(),
  ]);
  return apiJson(req, eventListResponseSchema, {
    data: events.map(serializeEvent),
    meta: paginationMeta(page, limit, total),
  });
});
