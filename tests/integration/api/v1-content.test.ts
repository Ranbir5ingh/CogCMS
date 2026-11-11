import { describe, expect, it } from 'vitest';
import { GET as getSite } from '@/app/api/v1/site/route';
import { GET as listAuthors } from '@/app/api/v1/authors/route';
import { GET as getAuthor } from '@/app/api/v1/authors/[slug]/route';
import { GET as listFaqs } from '@/app/api/v1/faqs/route';
import { GET as listWhitepapers } from '@/app/api/v1/whitepapers/route';
import { GET as getWhitepaper } from '@/app/api/v1/whitepapers/[slug]/route';
import { GET as listReleaseNotes } from '@/app/api/v1/release-notes/route';
import { GET as getReleaseNote } from '@/app/api/v1/release-notes/[slug]/route';
import Author from '@/models/Author';
import FAQ from '@/models/FAQ';
import Whitepaper from '@/models/Whitepaper';
import ReleaseNote from '@/models/ReleaseNote';
import { createTestSite, createTestUser } from '@/tests/setup/factories';
import { issueTestApiKey, publicApiRequest } from '@/tests/setup/public-api';

const rootContext = { params: Promise.resolve({}) };

describe('v1 site and content resources', () => {
  it('returns only the key-bound active site and rejects an archived site', async () => {
    const user = await createTestUser();
    const site = await createTestSite({ mediaPrefix: 'acme-media' });
    const key = await issueTestApiKey(site, user);
    const response = await getSite(
      publicApiRequest('http://localhost:3003/api/v1/site', key),
      rootContext,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('x-cms-version')).toBe('1.1');
    const body = await response.json();
    expect(body.data).toMatchObject({
      id: site._id.toString(),
      slug: site.slug,
      updatedAt: expect.any(String),
    });
    expect(body.data).not.toHaveProperty('_id');
    expect(body.data).not.toHaveProperty('webhookSecret');

    site.status = 'archived';
    await site.save();
    const archived = await getSite(
      publicApiRequest('http://localhost:3003/api/v1/site', key),
      rootContext,
    );
    expect(archived.status).toBe(401);
  });

  it('isolates published authors and drafts return 404', async () => {
    const user = await createTestUser();
    const [site, otherSite] = await Promise.all([createTestSite(), createTestSite()]);
    const key = await issueTestApiKey(site, user);
    await Author.create({ siteId: site._id, name: 'Ada', slug: 'ada', status: 'publish' });
    await Author.create({ siteId: site._id, name: 'Draft', slug: 'draft', status: 'draft' });
    await Author.create({ siteId: otherSite._id, name: 'Other', slug: 'other', status: 'publish' });

    const response = await listAuthors(
      publicApiRequest('http://localhost:3003/api/v1/authors?limit=1', key),
      rootContext,
    );
    const body = await response.json();
    expect(body.meta).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ name: 'Ada', slug: 'ada' });
    expect(body.data[0]).not.toHaveProperty('siteId');

    const draft = await getAuthor(
      publicApiRequest('http://localhost:3003/api/v1/authors/draft', key),
      { params: Promise.resolve({ slug: 'draft' }) },
    );
    expect(draft.status).toBe(404);
  });

  it('filters FAQs and gives whitepaper list/detail projections', async () => {
    const user = await createTestUser();
    const site = await createTestSite();
    const key = await issueTestApiKey(site, user);
    await FAQ.create({
      siteId: site._id,
      question: 'Billing?',
      answer: 'Monthly.',
      category: 'Billing',
      order: 2,
      status: 'publish',
    });
    await FAQ.create({
      siteId: site._id,
      question: 'Other?',
      answer: 'No.',
      category: 'Other',
      order: 1,
      status: 'publish',
    });
    await FAQ.create({
      siteId: site._id,
      question: 'Secret?',
      answer: 'Draft.',
      category: 'Billing',
      order: 0,
      status: 'draft',
    });
    await Whitepaper.create({
      siteId: site._id,
      title: 'AI Guide',
      slug: 'ai-guide',
      description: 'A guide',
      content: '# Start\n\nBody',
      tag: 'AI',
      tags: ['AI'],
      metaTitle: 'Guide meta',
      metaDescription: 'Meta',
      keywords: 'ai, guide',
      status: 'publish',
    });

    const faqs = await listFaqs(
      publicApiRequest('http://localhost:3003/api/v1/faqs?category=Billing', key),
      rootContext,
    );
    expect((await faqs.json()).data.map((item: { question: string }) => item.question)).toEqual([
      'Billing?',
    ]);

    const papers = await listWhitepapers(
      publicApiRequest('http://localhost:3003/api/v1/whitepapers?tag=AI', key),
      rootContext,
    );
    const listBody = await papers.json();
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0]).not.toHaveProperty('content');
    expect(listBody.data[0]).not.toHaveProperty('blocks');

    const detail = await getWhitepaper(
      publicApiRequest('http://localhost:3003/api/v1/whitepapers/ai-guide', key),
      { params: Promise.resolve({ slug: 'ai-guide' }) },
    );
    const detailBody = await detail.json();
    expect(detailBody.data.content).toBe('# Start\n\nBody');
    expect(detailBody.data.blocks).toEqual(expect.arrayContaining([{ type: 'h1', text: 'Start' }]));
    expect(detailBody.data.keywords).toEqual(['ai', 'guide']);
  });

  it('returns release-note snapshots and body only on detail', async () => {
    const user = await createTestUser();
    const site = await createTestSite();
    const key = await issueTestApiKey(site, user);
    await ReleaseNote.create({
      siteId: site._id,
      version: '1.2.0',
      slug: 'v1-2-0',
      releaseDate: new Date('2026-09-03T00:00:00.000Z'),
      bodyMarkdown: 'Hello release',
      status: 'publish',
    });
    await ReleaseNote.create({
      siteId: site._id,
      version: '2.0.0',
      slug: 'v2-0-0',
      releaseDate: new Date('2026-09-04T00:00:00.000Z'),
      bodyMarkdown: 'Draft release',
      status: 'draft',
    });

    const listed = await listReleaseNotes(
      publicApiRequest('http://localhost:3003/api/v1/release-notes', key),
      rootContext,
    );
    const listBody = await listed.json();
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0]).toMatchObject({ slug: 'v1-2-0', dateLabel: 'September 3, 2026' });
    expect(listBody.data[0]).not.toHaveProperty('bodyMarkdown');

    const detail = await getReleaseNote(
      publicApiRequest('http://localhost:3003/api/v1/release-notes/v1-2-0', key),
      { params: Promise.resolve({ slug: 'v1-2-0' }) },
    );
    expect((await detail.json()).data.bodyMarkdown).toBe('Hello release');
  });
});
