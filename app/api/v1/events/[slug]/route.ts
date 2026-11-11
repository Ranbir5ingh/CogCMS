import Event from '@/models/Event';
import { eventResponseSchema } from '@/contracts/v1/event';
import { serializeEvent } from '@/lib/api/v1/event';
import { apiJson, publishedFilter, withApiKey } from '@/lib/http/api-handler';
import { notFound } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';
export const GET = withApiKey<{ slug: string }>('content:read', async (req, { auth, params }) => {
  const event = await Event.findOne({
    ...publishedFilter(auth.siteId),
    slug: (await params).slug,
  }).exec();
  if (!event) throw notFound('Event');
  return apiJson(req, eventResponseSchema, { data: serializeEvent(event) });
});
