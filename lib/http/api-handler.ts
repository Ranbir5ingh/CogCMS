import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { authenticateApiKey, type ApiKeyAuth } from '@/lib/auth/api-key';
import type { ApiKeyScope } from '@/models/ApiKey';
import { toErrorResponse } from '@/lib/http/errors';
import type { RouteContext } from '@/lib/http/admin-handler';
import connectToDatabase from '@/lib/mongodb';
import Site, { type ISite } from '@/models/Site';
import { unauthorized } from '@/lib/http/errors';

export const CMS_API_VERSION = '1.1';
export const CMS_CACHE_CONTROL = 'private, max-age=60';

function withContractHeaders(response: NextResponse, etag?: string): NextResponse {
  response.headers.set('X-CMS-Version', CMS_API_VERSION);
  response.headers.set('Cache-Control', CMS_CACHE_CONTROL);
  if (etag) response.headers.set('ETag', etag);
  return response;
}

export function apiJson<T>(
  request: Pick<NextRequest, 'headers'>,
  schema: ZodType<T>,
  value: unknown,
  init: { status?: number } = {},
): NextResponse {
  const parsed = schema.parse(value);
  const body = JSON.stringify(parsed);
  const etag = `W/"${createHash('sha256').update(body).digest('hex')}"`;
  if (request.headers.get('if-none-match') === etag) {
    return withContractHeaders(new NextResponse(null, { status: 304 }), etag);
  }
  return withContractHeaders(
    new NextResponse(body, {
      status: init.status ?? 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
    etag,
  );
}

export type ApiContext<P = Record<string, string>> = RouteContext<P> & {
  auth: ApiKeyAuth;
  site: ISite;
};
export type ApiHandler<P = Record<string, string>> = (
  req: NextRequest,
  ctx: ApiContext<P>,
) => Promise<NextResponse>;

export function withApiKey<P = Record<string, string>>(
  scope: ApiKeyScope,
  handler: ApiHandler<P>,
): (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      const auth = await authenticateApiKey(req, scope);
      await connectToDatabase();
      const site = await Site.findOne({ _id: auth.siteId, status: 'active' }).exec();
      if (!site) throw unauthorized();
      return await handler(req, { ...ctx, auth, site });
    } catch (error) {
      return withContractHeaders(toErrorResponse(error));
    }
  };
}

export const publishedFilter = (siteId: string) => ({ siteId, status: 'publish' as const });
