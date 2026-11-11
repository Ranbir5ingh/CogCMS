import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  authorListResponseSchema,
  authorResponseSchema,
  faqListResponseSchema,
  faqSubmissionResponseSchema,
  newsletterResponseSchema,
  postListResponseSchema,
  postResponseSchema,
  releaseNoteListResponseSchema,
  releaseNoteResponseSchema,
  siteResponseSchema,
  whitepaperListResponseSchema,
  whitepaperResponseSchema,
} from '@/contracts/v1';
import { GET as getSite } from '@/app/api/v1/site/route';
import { GET as listAuthors } from '@/app/api/v1/authors/route';
import { GET as getAuthor } from '@/app/api/v1/authors/[slug]/route';
import { GET as listPosts } from '@/app/api/v1/posts/route';
import { GET as getPost } from '@/app/api/v1/posts/[slug]/route';
import { GET as listFaqs } from '@/app/api/v1/faqs/route';
import { GET as listWhitepapers } from '@/app/api/v1/whitepapers/route';
import { GET as getWhitepaper } from '@/app/api/v1/whitepapers/[slug]/route';
import { GET as listReleaseNotes } from '@/app/api/v1/release-notes/route';
import { GET as getReleaseNote } from '@/app/api/v1/release-notes/[slug]/route';
import { POST as submitFaq } from '@/app/api/v1/intake/faq-submissions/route';
import { POST as subscribe } from '@/app/api/v1/intake/newsletter-subscriptions/route';
import Author from '@/models/Author';
import Blog from '@/models/Blog';
import FAQ from '@/models/FAQ';
import ReleaseNote from '@/models/ReleaseNote';
import Whitepaper from '@/models/Whitepaper';
import { createTestSite, createTestUser } from '@/tests/setup/factories';
import { issueTestApiKey, publicApiRequest } from '@/tests/setup/public-api';

const base = 'http://localhost:3003/api/v1';
const rootContext = { params: Promise.resolve({}) };
const slugContext = (slug: string) => ({ params: Promise.resolve({ slug }) });
const rendered = {
  html: '<h2 id="intro">Intro</h2><p>Body</p>',
  toc: [{ id: 'intro', text: 'Intro', level: 2 }],
  wordCount: 120,
  readingTime: 1,
  pipelineVersion: 1,
  renderedAt: new Date('2026-09-01T00:00:00.000Z'),
};

async function expectConforms(response: Response, schema: z.ZodType, label: string) {
  expect(response.status, label).toBe(200);
  const body = await response.json();
  const parsed = schema.safeParse(body);
  expect(parsed.success, `${label}: ${parsed.error?.message ?? ''}`).toBe(true);
  return body;
}

async function seedPublishedContent() {
  const user = await createTestUser();
  const site = await createTestSite();
  const author = await Author.create({
    siteId: site._id,
    name: 'Ada',
    slug: 'ada',
    role: 'Engineer',
    bio: 'Writes code.',
    status: 'publish',
  });
  await Blog.create({
    siteId: site._id,
    title: 'Hello',
    slug: 'hello',
    excerpt: 'Hi',
    content: '<p>Body</p>',
    rendered,
    status: 'publish',
    authorId: author._id,
    tag: 'AI',
    tags: ['AI'],
    category: 'Engineering',
    keywords: 'ai, cms',
    faqs: [{ question: 'Why?', answer: 'Because.' }],
    keyTakeaways: ['One'],
    publishedAt: new Date('2026-09-02'),
  });
  await Blog.create({
    siteId: site._id,
    title: 'Related',
    slug: 'related',
    content: '<p>Related</p>',
    rendered,
    status: 'publish',
    category: 'Engineering',
    tags: ['AI'],
    publishedAt: new Date('2026-09-01'),
  });
  await FAQ.create({
    siteId: site._id,
    question: 'Q?',
    answer: 'A.',
    category: 'General',
    order: 0,
    status: 'publish',
  });
  await Whitepaper.create({
    siteId: site._id,
    title: 'Guide',
    slug: 'guide',
    description: 'A guide',
    content: '# Start\n\nBody',
    tag: 'AI',
    tags: ['AI'],
    keywords: 'ai, guide',
    status: 'publish',
  });
  await ReleaseNote.create({
    siteId: site._id,
    version: '1.0',
    slug: 'v1-0',
    releaseDate: new Date('2026-09-03T00:00:00.000Z'),
    bodyMarkdown: 'Intro.\n\n## Added\n\n- Thing\n',
    status: 'publish',
  });
  return { site, user, key: await issueTestApiKey(site, user) };
}

describe('v1 responses conform to the published zod contracts', () => {
  it('site, authors, posts, FAQs, whitepapers, and release notes', async () => {
    const { key } = await seedPublishedContent();
    const get = (path: string) => publicApiRequest(`${base}/${path}`, key);

    await expectConforms(await getSite(get('site'), rootContext), siteResponseSchema, 'site');
    await expectConforms(
      await listAuthors(get('authors'), rootContext),
      authorListResponseSchema,
      'authors',
    );
    await expectConforms(
      await getAuthor(get('authors/ada'), slugContext('ada')),
      authorResponseSchema,
      'author',
    );

    const posts = await expectConforms(
      await listPosts(get('posts'), rootContext),
      postListResponseSchema,
      'posts',
    );
    expect(posts.data.length).toBe(2);
    await expectConforms(
      await listPosts(get('posts?include=author'), rootContext),
      postListResponseSchema,
      'posts?include=author',
    );
    await expectConforms(
      await listPosts(get('posts?fields=slugs'), rootContext),
      postListResponseSchema,
      'posts?fields=slugs',
    );
    await expectConforms(
      await getPost(get('posts/hello'), slugContext('hello')),
      postResponseSchema,
      'post',
    );
    await expectConforms(
      await getPost(get('posts/hello?include=author,related,jsonLd,raw'), slugContext('hello')),
      postResponseSchema,
      'post with every include',
    );

    await expectConforms(await listFaqs(get('faqs'), rootContext), faqListResponseSchema, 'faqs');
    await expectConforms(
      await listWhitepapers(get('whitepapers'), rootContext),
      whitepaperListResponseSchema,
      'whitepapers',
    );
    await expectConforms(
      await getWhitepaper(get('whitepapers/guide'), slugContext('guide')),
      whitepaperResponseSchema,
      'whitepaper',
    );
    await expectConforms(
      await listReleaseNotes(get('release-notes'), rootContext),
      releaseNoteListResponseSchema,
      'release-notes',
    );
    await expectConforms(
      await getReleaseNote(get('release-notes/v1-0'), slugContext('v1-0')),
      releaseNoteResponseSchema,
      'release-note',
    );
  });

  it('empty lists still conform', async () => {
    const user = await createTestUser();
    const site = await createTestSite();
    const key = await issueTestApiKey(site, user);
    const get = (path: string) => publicApiRequest(`${base}/${path}`, key);
    for (const [path, handler, schema] of [
      ['authors', listAuthors, authorListResponseSchema],
      ['posts', listPosts, postListResponseSchema],
      ['faqs', listFaqs, faqListResponseSchema],
      ['whitepapers', listWhitepapers, whitepaperListResponseSchema],
      ['release-notes', listReleaseNotes, releaseNoteListResponseSchema],
    ] as const) {
      const body = await expectConforms(await handler(get(path), rootContext), schema, path);
      expect(body.data).toEqual([]);
    }
  });

  it('intake responses conform', async () => {
    const user = await createTestUser();
    const site = await createTestSite();
    const key = await issueTestApiKey(site, user, ['intake:write']);
    const post = (path: string, json: unknown) =>
      publicApiRequest(`${base}/intake/${path}`, key, {
        method: 'POST',
        json,
        headers: { 'x-cms-visitor-ip': '203.0.113.9' },
      });

    const faq = await submitFaq(post('faq-submissions', { question: 'Contract?' }), rootContext);
    expect(faq.status).toBe(201);
    expect(faqSubmissionResponseSchema.safeParse(await faq.json()).success).toBe(true);

    const newsletter = await subscribe(
      post('newsletter-subscriptions', { email: 'reader@example.com' }),
      rootContext,
    );
    expect([200, 201]).toContain(newsletter.status);
    expect(newsletterResponseSchema.safeParse(await newsletter.json()).success).toBe(true);
  });
});
