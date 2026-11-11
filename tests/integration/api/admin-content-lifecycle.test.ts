import { describe, expect, it } from 'vitest';
import { POST as createAuthor } from '@/app/api/admin/authors/route';
import {
  DELETE as deleteAuthor,
  GET as getAuthor,
  PUT as updateAuthor,
} from '@/app/api/admin/authors/[slug]/route';
import { GET as listFaqs, POST as createFaq } from '@/app/api/admin/faqs/route';
import {
  DELETE as deleteFaq,
  GET as getFaq,
  PUT as updateFaq,
} from '@/app/api/admin/faqs/[id]/route';
import { GET as listNotes, POST as createNote } from '@/app/api/admin/release-notes/route';
import {
  DELETE as deleteNote,
  GET as getNote,
  PUT as updateNote,
} from '@/app/api/admin/release-notes/[slug]/route';
import {
  GET as listWhitepapers,
  POST as createWhitepaper,
} from '@/app/api/admin/whitepapers/route';
import {
  DELETE as deleteWhitepaper,
  GET as getWhitepaper,
  PUT as updateWhitepaper,
} from '@/app/api/admin/whitepapers/[slug]/route';
import type { IUser } from '@/models/User';
import { authenticatedRequest, createTestSite, createTestUser } from '@/tests/setup/factories';

const rootContext = { params: Promise.resolve({}) };
const idContext = (id: string) => ({ params: Promise.resolve({ id }) });
const slugContext = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function setup(): Promise<{
  request: (
    path: string,
    method?: string,
    json?: unknown,
  ) => ReturnType<typeof authenticatedRequest>;
  user: IUser;
}> {
  const user = await createTestUser();
  const site = await createTestSite();
  const request = (path: string, method = 'GET', json?: unknown) =>
    authenticatedRequest(`http://localhost:3003/api/admin/${path}`, {
      user,
      siteId: site._id.toString(),
      method,
      json,
    });
  return { request, user };
}

describe('admin content lifecycle', () => {
  it('creates, publishes, unpublishes, and deletes a FAQ', async () => {
    const { request, user } = await setup();
    const created = await createFaq(
      await request('faqs', 'POST', { question: 'How?', answer: 'Like this.', status: 'draft' }),
      rootContext,
    );
    expect(created.status).toBe(201);
    const faq = await created.json();
    expect(faq).toMatchObject({ status: 'draft', category: 'General', publishedAt: null });
    expect(faq.createdBy).toBe(user._id.toString());

    const published = await (
      await updateFaq(
        await request(`faqs/${faq._id}`, 'PUT', { status: 'publish' }),
        idContext(faq._id),
      )
    ).json();
    expect(published.status).toBe('publish');
    const firstPublishedAt = published.publishedAt;
    expect(firstPublishedAt).toBeTruthy();

    const unpublished = await (
      await updateFaq(
        await request(`faqs/${faq._id}`, 'PUT', { status: 'draft' }),
        idContext(faq._id),
      )
    ).json();
    expect(unpublished.status).toBe('draft');
    const republished = await (
      await updateFaq(
        await request(`faqs/${faq._id}`, 'PUT', { status: 'publish' }),
        idContext(faq._id),
      )
    ).json();
    expect(republished.publishedAt).toBe(firstPublishedAt);

    expect((await getFaq(await request(`faqs/${faq._id}`), idContext(faq._id))).status).toBe(200);
    expect(
      (await deleteFaq(await request(`faqs/${faq._id}`, 'DELETE', {}), idContext(faq._id))).status,
    ).toBe(200);
    expect((await getFaq(await request(`faqs/${faq._id}`), idContext(faq._id))).status).toBe(404);
    expect(
      (await deleteFaq(await request(`faqs/${faq._id}`, 'DELETE', {}), idContext(faq._id))).status,
    ).toBe(404);
    expect(await (await listFaqs(await request('faqs'), rootContext)).json()).toEqual([]);
  });

  it('returns 404 for a malformed FAQ id instead of a server error', async () => {
    const { request } = await setup();
    expect((await getFaq(await request('faqs/not-an-id'), idContext('not-an-id'))).status).toBe(
      404,
    );
    expect(
      (
        await updateFaq(
          await request('faqs/not-an-id', 'PUT', { answer: 'x' }),
          idContext('not-an-id'),
        )
      ).status,
    ).toBe(404);
  });

  it('creates, publishes, unpublishes, and deletes a whitepaper', async () => {
    const { request } = await setup();
    const created = await createWhitepaper(
      await request('whitepapers', 'POST', {
        title: 'Lifecycle Paper',
        slug: 'lifecycle-paper',
        description: 'A paper',
        content: 'Body',
        status: 'draft',
      }),
      rootContext,
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ status: 'draft', publishedAt: null });

    const published = await (
      await updateWhitepaper(
        await request('whitepapers/lifecycle-paper', 'PUT', { status: 'publish' }),
        slugContext('lifecycle-paper'),
      )
    ).json();
    const firstPublishedAt = published.publishedAt;
    expect(firstPublishedAt).toBeTruthy();

    await updateWhitepaper(
      await request('whitepapers/lifecycle-paper', 'PUT', { status: 'draft' }),
      slugContext('lifecycle-paper'),
    );
    const republished = await (
      await updateWhitepaper(
        await request('whitepapers/lifecycle-paper', 'PUT', {
          status: 'publish',
          title: 'Renamed',
        }),
        slugContext('lifecycle-paper'),
      )
    ).json();
    expect(republished).toMatchObject({ title: 'Renamed', publishedAt: firstPublishedAt });

    expect(
      (
        await deleteWhitepaper(
          await request('whitepapers/lifecycle-paper', 'DELETE', {}),
          slugContext('lifecycle-paper'),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await getWhitepaper(
          await request('whitepapers/lifecycle-paper'),
          slugContext('lifecycle-paper'),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await deleteWhitepaper(
          await request('whitepapers/lifecycle-paper', 'DELETE', {}),
          slugContext('lifecycle-paper'),
        )
      ).status,
    ).toBe(404);
    expect(await (await listWhitepapers(await request('whitepapers'), rootContext)).json()).toEqual(
      [],
    );
  });

  it('creates, publishes, unpublishes, and deletes an author', async () => {
    const { request } = await setup();
    const created = await createAuthor(
      await request('authors', 'POST', { name: 'Grace', slug: 'grace', status: 'draft' }),
      rootContext,
    );
    expect(created.status).toBe(201);

    const published = await (
      await updateAuthor(
        await request('authors/grace', 'PUT', { status: 'publish' }),
        slugContext('grace'),
      )
    ).json();
    expect(published.status).toBe('publish');
    const unpublished = await (
      await updateAuthor(
        await request('authors/grace', 'PUT', { status: 'draft' }),
        slugContext('grace'),
      )
    ).json();
    expect(unpublished.status).toBe('draft');

    expect(
      (await deleteAuthor(await request('authors/grace', 'DELETE', {}), slugContext('grace')))
        .status,
    ).toBe(200);
    expect((await getAuthor(await request('authors/grace'), slugContext('grace'))).status).toBe(
      404,
    );
    expect(
      (await deleteAuthor(await request('authors/grace', 'DELETE', {}), slugContext('grace')))
        .status,
    ).toBe(404);
  });

  it('publishes, unpublishes, and deletes a release note', async () => {
    const { request } = await setup();
    const created = await createNote(
      await request('release-notes', 'POST', {
        version: '5.1',
        date: '2026-09-20',
        bodyMarkdown: '## Added\n\n- Lifecycle tests\n',
        status: 'publish',
      }),
      rootContext,
    );
    expect(created.status).toBe(201);
    const note = await created.json();
    expect(note).toMatchObject({ slug: 'v5-1', status: 'publish' });
    expect(note.publishedAt).toBeTruthy();

    const unpublished = await (
      await updateNote(
        await request('release-notes/v5-1', 'PUT', { status: 'draft' }),
        slugContext('v5-1'),
      )
    ).json();
    expect(unpublished.status).toBe('draft');

    expect(
      (await deleteNote(await request('release-notes/v5-1', 'DELETE', {}), slugContext('v5-1')))
        .status,
    ).toBe(200);
    expect((await getNote(await request('release-notes/v5-1'), slugContext('v5-1'))).status).toBe(
      404,
    );
    expect(
      (await deleteNote(await request('release-notes/v5-1', 'DELETE', {}), slugContext('v5-1')))
        .status,
    ).toBe(404);
    expect(await (await listNotes(await request('release-notes'), rootContext)).json()).toEqual([]);
  });

  it('rejects invalid payloads without writing', async () => {
    const { request } = await setup();
    expect(
      (await createFaq(await request('faqs', 'POST', { question: '', answer: 'A' }), rootContext))
        .status,
    ).toBe(400);
    expect(
      (
        await createWhitepaper(
          await request('whitepapers', 'POST', { title: 'No body' }),
          rootContext,
        )
      ).status,
    ).toBe(400);
    expect(
      (await createNote(await request('release-notes', 'POST', { version: '' }), rootContext))
        .status,
    ).toBe(400);
    expect(await (await listFaqs(await request('faqs'), rootContext)).json()).toEqual([]);
    expect(await (await listWhitepapers(await request('whitepapers'), rootContext)).json()).toEqual(
      [],
    );
    expect(await (await listNotes(await request('release-notes'), rootContext)).json()).toEqual([]);
  });
});
