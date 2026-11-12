import { requireUser } from '@/lib/auth/require';
import { resolveSite } from '@/lib/site/context';
import { toErrorResponse, validationError } from '@/lib/http/errors';
import { getSnapshot, leavePresence, touchPresence } from '@/lib/collaboration/service';
import { resourceQuerySchema } from '@/lib/validation/collaboration';
import { SSE_POLL_MS } from '@/lib/collaboration/types';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const site = await resolveSite(req, user);
    const parsed = resourceQuerySchema.safeParse({
      resourceType: req.nextUrl.searchParams.get('resourceType') ?? undefined,
      resourceId: req.nextUrl.searchParams.get('resourceId') ?? undefined,
    });
    if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid collaboration query');
    const { resourceType, resourceId } = parsed.data;
    await touchPresence(site.id, resourceType, resourceId, user);

    const encoder = new TextEncoder();
    let last = '';
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (event: string, data: unknown) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        const tick = async () => {
          const snapshot = await getSnapshot(site.id, resourceType, resourceId);
          const encoded = JSON.stringify(snapshot);
          if (encoded !== last) {
            last = encoded;
            send('snapshot', snapshot);
          } else {
            controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          }
        };
        try {
          await tick();
        } catch (error) {
          send('error', { error: error instanceof Error ? error.message : 'stream error' });
        }
        const interval = setInterval(() => {
          void tick().catch((error) => {
            send('error', { error: error instanceof Error ? error.message : 'stream error' });
          });
        }, SSE_POLL_MS);
        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          void leavePresence(site.id, resourceType, resourceId, user);
        };
        req.signal.addEventListener('abort', close, { once: true });
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
