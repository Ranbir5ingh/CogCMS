import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiJson } from '@/lib/http/api-handler';

describe('v1 responses', () => {
  const schema = z.object({ data: z.object({ id: z.string() }) }).strict();

  it('sets the public contract headers and a deterministic weak ETag', async () => {
    const request = new NextRequest('http://localhost:3003/api/v1/site');
    const first = apiJson(request, schema, { data: { id: 'site-1' } });
    const second = apiJson(request, schema, { data: { id: 'site-1' } });
    expect(first.status).toBe(200);
    expect(first.headers.get('x-cms-version')).toBe('1.1');
    expect(first.headers.get('cache-control')).toBe('private, max-age=60');
    expect(first.headers.get('etag')).toMatch(/^W\/[\"]{1}[a-f\d]{64}[\"]{1}$/);
    expect(second.headers.get('etag')).toBe(first.headers.get('etag'));
    expect(await first.json()).toEqual({ data: { id: 'site-1' } });
  });

  it('returns an empty 304 when If-None-Match matches', async () => {
    const initial = apiJson(new NextRequest('http://localhost:3003/api/v1/site'), schema, {
      data: { id: 'site-1' },
    });
    const request = new NextRequest('http://localhost:3003/api/v1/site', {
      headers: { 'if-none-match': initial.headers.get('etag')! },
    });
    const response = apiJson(request, schema, { data: { id: 'site-1' } });
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
    expect(response.headers.get('etag')).toBe(initial.headers.get('etag'));
    expect(response.headers.get('x-cms-version')).toBe('1.1');
  });

  it('refuses output that violates the declared contract', () => {
    expect(() =>
      apiJson(new NextRequest('http://localhost'), schema, { data: { id: 42 } }),
    ).toThrow();
  });
});
