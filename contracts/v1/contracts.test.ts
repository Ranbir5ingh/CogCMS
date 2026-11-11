import { describe, expect, it } from 'vitest';
import { authorViewSchema } from '@/contracts/v1/author';
import { postSummarySchema } from '@/contracts/v1/post';
import { siteViewSchema } from '@/contracts/v1/site';

describe('v1 output contracts', () => {
  it('parses public fixtures', () => {
    expect(
      siteViewSchema.parse({
        id: 'site-1',
        slug: 'site',
        name: 'Site',
        primaryDomain: 'https://site.test',
        publicPaths: {
          blogs: '/blogs',
          whitepapers: '/whitepapers',
          faq: '/faq',
          releaseNotes: '/release-notes',
        },
        publisher: { name: 'Site', url: 'https://site.test', logoUrl: '' },
        mediaBaseUrl: null,
        updatedAt: '2026-09-03T00:00:00.000Z',
      }),
    ).toMatchObject({ id: 'site-1', mediaBaseUrl: null });
    expect(
      postSummarySchema.parse({
        id: 'post-1',
        title: 'Post',
        slug: 'post',
        excerpt: '',
        imageUrl: 'https://cdn.example.com/cover.jpg',
        imageAlt: 'Dashboard showing AI citation share',
        tag: '',
        category: '',
        tags: [],
        isFeatured: false,
        publishedAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      }),
    ).toMatchObject({ imageAlt: 'Dashboard showing AI citation share' });
  });

  it('rejects internal tenant and database fields rather than silently stripping them', () => {
    const author = {
      id: 'author-1',
      slug: 'ada',
      name: 'Ada',
      role: '',
      bio: '',
      avatarUrl: '',
      socials: { x: '', linkedin: '', website: '' },
    };
    expect(authorViewSchema.safeParse({ ...author, _id: 'mongo-id' }).success).toBe(false);
    expect(authorViewSchema.safeParse({ ...author, siteId: 'site-1' }).success).toBe(false);
    expect(
      postSummarySchema.safeParse({
        id: 'post-1',
        title: 'Post',
        slug: 'post',
        excerpt: '',
        imageUrl: '',
        imageAlt: '',
        tag: '',
        category: '',
        tags: [],
        isFeatured: false,
        publishedAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
        relatedSlugs: ['secret'],
      }).success,
    ).toBe(false);
  });
});
