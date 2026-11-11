import { describe, expect, it, vi } from 'vitest';
import { CmsApiError, createCmsClient } from '@/packages/cms-client/src/index';

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('CMS client', () => {
  it('sends authentication/client headers, encodes queries, and passes fetch options through', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json({ data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } }));
    const signal = new AbortController().signal;
    const client = createCmsClient({
      baseUrl: 'https://cms.example.com/',
      apiKey: 'cms_12345678_abcdefghijklmnopqrstuvwxyzABCDEF',
      fetch,
      userAgent: 'landing/1.0',
    });
    await client.posts.list(
      { page: 2, tag: 'AI & ML', featured: true, include: 'author' },
      { cache: 'no-store', signal, next: { revalidate: 60, tags: ['cms:posts'] } },
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://cms.example.com/api/v1/posts?page=2&tag=AI+%26+ML&featured=true&include=author',
    );
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toContain('Bearer cms_12345678_');
    expect(headers.get('x-cms-client')).toBe('cms-client/1');
    expect(headers.get('user-agent')).toBe('landing/1.0');
    expect(init).toMatchObject({
      cache: 'no-store',
      signal,
      next: { revalidate: 60, tags: ['cms:posts'] },
    });
  });

  it('offers every resource method and returns single resources without their envelope', async () => {
    const fetch = vi.fn().mockResolvedValue(
      json({
        data: {
          id: '1',
          slug: 'ada',
          name: 'Ada',
          role: '',
          bio: '',
          avatarUrl: '',
          socials: { x: '', linkedin: '', website: '' },
        },
      }),
    );
    const client = createCmsClient({
      baseUrl: 'https://cms.example.com/api/v1',
      apiKey: 'key',
      fetch,
    });
    await expect(client.authors.get('ada')).resolves.toMatchObject({ slug: 'ada' });
    expect(fetch.mock.calls[0][0]).toBe('https://cms.example.com/api/v1/authors/ada');
    expect(client).toMatchObject({
      site: { get: expect.any(Function) },
      posts: { list: expect.any(Function), get: expect.any(Function) },
      authors: { list: expect.any(Function), get: expect.any(Function) },
      faqs: { list: expect.any(Function) },
      whitepapers: { list: expect.any(Function), get: expect.any(Function) },
      releaseNotes: { list: expect.any(Function), get: expect.any(Function) },
      events: { list: expect.any(Function), get: expect.any(Function) },
      intake: { faqSubmission: expect.any(Function), newsletter: expect.any(Function) },
    });
  });

  it('returns null for detail 404s and empty 304 responses', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({ error: 'Not found', code: 'NOT_FOUND', details: null }, { status: 404 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const client = createCmsClient({ baseUrl: 'https://cms.example.com', apiKey: 'key', fetch });
    await expect(client.posts.get('missing')).resolves.toBeNull();
    await expect(
      client.posts.list({}, { headers: { 'If-None-Match': 'W/"etag"' } }),
    ).resolves.toBeNull();
  });

  it('throws typed API errors and sends intake JSON', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(
          { error: 'Bad input', code: 'VALIDATION_ERROR', details: { field: 'email' } },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(json({ data: { subscribed: true, new: true } }, { status: 201 }));
    const client = createCmsClient({ baseUrl: 'https://cms.example.com', apiKey: 'key', fetch });
    const error = await client.site.get().catch((caught) => caught);
    expect(error).toBeInstanceOf(CmsApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: { field: 'email' },
    });
    await expect(client.intake.newsletter({ email: 'reader@example.com' })).resolves.toEqual({
      subscribed: true,
      new: true,
    });
    const [, init] = fetch.mock.calls[1];
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ email: 'reader@example.com' }));
  });
});
