import { beforeEach, describe, expect, it, vi } from 'vitest';

const notifySiteWebhook = vi.hoisted(() => vi.fn());
vi.mock('@/lib/webhook', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/webhook')>()),
  notifySiteWebhook,
}));

import { POST as createAuthor } from '@/app/api/admin/authors/route';
import { DELETE as deleteAuthor, PUT as updateAuthor } from '@/app/api/admin/authors/[slug]/route';
import { POST as createFaq } from '@/app/api/admin/faqs/route';
import { DELETE as deleteFaq, PUT as updateFaq } from '@/app/api/admin/faqs/[id]/route';
import { POST as createNote } from '@/app/api/admin/release-notes/route';
import {
  DELETE as deleteNote,
  PUT as updateNote,
} from '@/app/api/admin/release-notes/[slug]/route';
import { POST as createWhitepaper } from '@/app/api/admin/whitepapers/route';
import {
  DELETE as deleteWhitepaper,
  PUT as updateWhitepaper,
} from '@/app/api/admin/whitepapers/[slug]/route';
import { authenticatedRequest, createTestSite, createTestUser } from '@/tests/setup/factories';

type Handler = (
  req: Awaited<ReturnType<typeof authenticatedRequest>>,
  ctx: never,
) => Promise<Response>;

async function setup() {
  const site = await createTestSite();
  const user = await createTestUser({ siteIds: [site._id.toString()] });
  const siteId = site._id.toString();
  const call = async (handler: Handler, path: string, method: string, json: unknown, params = {}) =>
    handler(
      await authenticatedRequest(`http://localhost:3003/api/admin/${path}`, {
        user,
        siteId,
        method,
        json,
      }),
      { params: Promise.resolve(params) } as never,
    );
  return { siteId, call };
}

function expectLastEvent(siteId: string, event: Record<string, unknown>) {
  expect(notifySiteWebhook).toHaveBeenLastCalledWith(siteId, expect.objectContaining(event));
}

describe('content webhook events', () => {
  beforeEach(() => notifySiteWebhook.mockReset());

  it('dispatches author publish, update, unpublish, and delete transitions', async () => {
    const { siteId, call } = await setup();
    const created = await call(createAuthor as Handler, 'authors', 'POST', {
      name: 'Ada',
      slug: 'ada',
    });
    const author = await created.json();
    expectLastEvent(siteId, {
      type: 'content.published',
      contentType: 'author',
      slug: 'ada',
      id: author._id,
    });

    await call(updateAuthor as Handler, 'authors/ada', 'PUT', { bio: 'Updated' }, { slug: 'ada' });
    expectLastEvent(siteId, { type: 'content.updated', contentType: 'author' });
    await call(updateAuthor as Handler, 'authors/ada', 'PUT', { status: 'draft' }, { slug: 'ada' });
    expectLastEvent(siteId, { type: 'content.unpublished', contentType: 'author' });
    await call(
      updateAuthor as Handler,
      'authors/ada',
      'PUT',
      { status: 'publish' },
      { slug: 'ada' },
    );
    expectLastEvent(siteId, { type: 'content.published', contentType: 'author' });
    await call(deleteAuthor as Handler, 'authors/ada', 'DELETE', {}, { slug: 'ada' });
    expectLastEvent(siteId, { type: 'content.deleted', contentType: 'author', slug: 'ada' });
  });

  it('dispatches FAQ transitions keyed by id', async () => {
    const { siteId, call } = await setup();
    const faq = await (
      await call(createFaq as Handler, 'faqs', 'POST', { question: 'Q?', answer: 'A.' })
    ).json();
    expectLastEvent(siteId, {
      type: 'content.published',
      contentType: 'faq',
      slug: faq._id,
      id: faq._id,
    });

    const params = { id: faq._id };
    await call(updateFaq as Handler, `faqs/${faq._id}`, 'PUT', { answer: 'B.' }, params);
    expectLastEvent(siteId, { type: 'content.updated', contentType: 'faq' });
    await call(updateFaq as Handler, `faqs/${faq._id}`, 'PUT', { status: 'draft' }, params);
    expectLastEvent(siteId, { type: 'content.unpublished', contentType: 'faq' });
    await call(updateFaq as Handler, `faqs/${faq._id}`, 'PUT', { status: 'publish' }, params);
    await call(deleteFaq as Handler, `faqs/${faq._id}`, 'DELETE', {}, params);
    expectLastEvent(siteId, { type: 'content.deleted', contentType: 'faq', id: faq._id });
  });

  it('dispatches whitepaper transitions', async () => {
    const { siteId, call } = await setup();
    const paper = await (
      await call(createWhitepaper as Handler, 'whitepapers', 'POST', {
        title: 'Paper',
        slug: 'paper',
        description: 'Desc',
        content: 'Body',
      })
    ).json();
    expectLastEvent(siteId, {
      type: 'content.published',
      contentType: 'whitepaper',
      slug: 'paper',
      id: paper._id,
    });

    const params = { slug: 'paper' };
    await call(updateWhitepaper as Handler, 'whitepapers/paper', 'PUT', { title: 'New' }, params);
    expectLastEvent(siteId, { type: 'content.updated', contentType: 'whitepaper' });
    await call(
      updateWhitepaper as Handler,
      'whitepapers/paper',
      'PUT',
      { status: 'draft' },
      params,
    );
    expectLastEvent(siteId, { type: 'content.unpublished', contentType: 'whitepaper' });
    await call(
      updateWhitepaper as Handler,
      'whitepapers/paper',
      'PUT',
      { status: 'publish' },
      params,
    );
    await call(deleteWhitepaper as Handler, 'whitepapers/paper', 'DELETE', {}, params);
    expectLastEvent(siteId, { type: 'content.deleted', contentType: 'whitepaper', slug: 'paper' });
  });

  it('dispatches release-note transitions', async () => {
    const { siteId, call } = await setup();
    const note = await (
      await call(createNote as Handler, 'release-notes', 'POST', {
        version: '6.0',
        date: '2026-09-21',
        bodyMarkdown: '## Added\n\n- Events\n',
        status: 'publish',
      })
    ).json();
    expectLastEvent(siteId, {
      type: 'content.published',
      contentType: 'releaseNote',
      slug: 'v6-0',
      id: note.id,
    });

    const params = { slug: 'v6-0' };
    await call(
      updateNote as Handler,
      'release-notes/v6-0',
      'PUT',
      { bodyMarkdown: 'Changed' },
      params,
    );
    expectLastEvent(siteId, { type: 'content.updated', contentType: 'releaseNote' });
    await call(updateNote as Handler, 'release-notes/v6-0', 'PUT', { status: 'draft' }, params);
    expectLastEvent(siteId, { type: 'content.unpublished', contentType: 'releaseNote' });
    await call(updateNote as Handler, 'release-notes/v6-0', 'PUT', { status: 'publish' }, params);
    await call(deleteNote as Handler, 'release-notes/v6-0', 'DELETE', {}, params);
    expectLastEvent(siteId, { type: 'content.deleted', contentType: 'releaseNote', slug: 'v6-0' });
  });

  it('stays silent for drafts: no event on draft create, draft edit, or draft delete', async () => {
    const { call } = await setup();
    await call(createWhitepaper as Handler, 'whitepapers', 'POST', {
      title: 'Draft',
      slug: 'draft-paper',
      description: 'Desc',
      content: 'Body',
      status: 'draft',
    });
    const params = { slug: 'draft-paper' };
    await call(
      updateWhitepaper as Handler,
      'whitepapers/draft-paper',
      'PUT',
      { title: 'Still draft' },
      params,
    );
    await call(deleteWhitepaper as Handler, 'whitepapers/draft-paper', 'DELETE', {}, params);
    const faq = await (
      await call(createFaq as Handler, 'faqs', 'POST', {
        question: 'Q?',
        answer: 'A.',
        status: 'draft',
      })
    ).json();
    await call(deleteFaq as Handler, `faqs/${faq._id}`, 'DELETE', {}, { id: faq._id });
    expect(notifySiteWebhook).not.toHaveBeenCalled();
  });

  it('never notifies when a mutation is rejected', async () => {
    const { call } = await setup();
    await call(createFaq as Handler, 'faqs', 'POST', { question: '', answer: 'A.' });
    await call(
      updateWhitepaper as Handler,
      'whitepapers/missing',
      'PUT',
      { title: 'X' },
      { slug: 'missing' },
    );
    await call(deleteNote as Handler, 'release-notes/missing', 'DELETE', {}, { slug: 'missing' });
    expect(notifySiteWebhook).not.toHaveBeenCalled();
  });
});
