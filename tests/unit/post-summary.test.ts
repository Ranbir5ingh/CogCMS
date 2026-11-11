import { describe, expect, it } from 'vitest';
import Blog from '@/models/Blog';
import { serializePostSummary } from '@/lib/api/v1/serializers';

describe('public blog card description', () => {
  it.each([
    ['Editorial excerpt', 'Search description', 'Editorial excerpt'],
    ['', 'Search description', 'Search description'],
    ['', '', ''],
  ])(
    'preserves the website fallback for excerpt %j and metadata %j',
    (excerpt, metaDescription, expected) => {
      const post = new Blog({
        title: 'Test post',
        slug: 'test-post',
        excerpt,
        metaDescription,
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      });
      expect(serializePostSummary(post).excerpt).toBe(expected);
    },
  );
});

describe('public blog cover image alt text', () => {
  it.each([
    ['A team reviewing an AI visibility report', 'A team reviewing an AI visibility report'],
    [undefined, ''],
  ])('serializes imageAlt %j as %j', (imageAlt, expected) => {
    const post = new Blog({
      title: 'Test post',
      slug: 'test-post',
      imageUrl: 'https://cdn.example.com/cover.jpg',
      imageAlt,
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(serializePostSummary(post).imageAlt).toBe(expected);
  });
});
