import { createHmac } from 'node:crypto';
import { after } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Site from '@/models/Site';

export const WEBHOOK_TIMEOUT_MS = 5_000;
export const WEBHOOK_RETRY_DELAY_MS = 2_000;

export type ContentType =
  'post' | 'author' | 'faq' | 'whitepaper' | 'releaseNote' | 'event' | 'site';
export type WebhookEventType =
  'content.published' | 'content.updated' | 'content.unpublished' | 'content.deleted';
export type WebhookEvent = {
  type: WebhookEventType;
  contentType: ContentType;
  slug: string;
  id: string;
};
export type WebhookSite = { id: string; webhookUrl: string; webhookSecret: string };

type DeliveryDependencies = {
  fetch: typeof globalThis.fetch;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => Date;
  warn: (message: string, error?: unknown) => void;
};

const defaults: DeliveryDependencies = {
  fetch: globalThis.fetch,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now: () => new Date(),
  warn: (message, error) => console.warn(message, error),
};

export function deliveryEventType(
  before: 'draft' | 'publish',
  after: 'draft' | 'publish',
): WebhookEventType | null {
  if (before === 'draft' && after === 'publish') return 'content.published';
  if (before === 'publish' && after === 'draft') return 'content.unpublished';
  if (before === 'publish' && after === 'publish') return 'content.updated';
  return null;
}

export async function deliverSiteWebhook(
  site: WebhookSite,
  event: WebhookEvent,
  dependencies: Partial<DeliveryDependencies> = {},
): Promise<void> {
  const deps = { ...defaults, ...dependencies };
  const at = deps.now();
  const rawBody = JSON.stringify({
    type: event.type,
    siteId: site.id,
    contentType: event.contentType,
    slug: event.slug,
    id: event.id,
    at: at.toISOString(),
  });
  const timestamp = String(Math.floor(at.getTime() / 1_000));
  const signature = createHmac('sha256', site.webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await deps.fetch(site.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CMS-Event': event.type,
          'X-CMS-Timestamp': timestamp,
          'X-CMS-Signature': `sha256=${signature}`,
        },
        body: rawBody,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (response.ok) return;
      lastError = new Error(`Webhook returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await deps.sleep(WEBHOOK_RETRY_DELAY_MS);
  }
  deps.warn('[cms] webhook delivery failed', lastError);
}

/** Register bounded best-effort delivery with the request lifetime on Vercel. */
export function notifySiteWebhook(siteId: string, event: WebhookEvent): void {
  try {
    after(async () => {
      try {
        await connectToDatabase();
        const site = await Site.findById(siteId).select('+webhookSecret').exec();
        if (!site?.webhookUrl || !site.webhookSecret) return;
        await deliverSiteWebhook(
          {
            id: site._id.toString(),
            webhookUrl: site.webhookUrl,
            webhookSecret: site.webhookSecret,
          },
          event,
        );
      } catch {
        console.warn('[cms] webhook dispatch failed');
      }
    });
  } catch {
    // The content mutation has already succeeded; scheduling cannot undo it.
    console.warn('[cms] webhook scheduling failed');
  }
}
