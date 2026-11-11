import { describe, expect, it } from 'vitest';
import { authorInputSchema } from './author';

describe('author validation', () => {
  const valid = { name: 'Jane Doe', slug: 'jane-doe' };

  it('accepts an author without the optional avatar', () => {
    expect(authorInputSchema.safeParse(valid).success).toBe(true);
    expect(authorInputSchema.safeParse({ ...valid, avatarUrl: '' }).success).toBe(true);
  });

  it('accepts an http(s) avatar URL', () => {
    expect(
      authorInputSchema.safeParse({ ...valid, avatarUrl: 'https://cdn.example.com/jane.jpg' })
        .success,
    ).toBe(true);
  });

  it('rejects an avatar that is not a usable URL', () => {
    for (const avatarUrl of ['not a url', 'cdn.example.com/jane.jpg', 'ftp://example.com/j.png']) {
      expect(authorInputSchema.safeParse({ ...valid, avatarUrl }).success).toBe(false);
    }
  });

  it('rejects a host without a real domain suffix', () => {
    for (const avatarUrl of [
      'https://abc',
      'http://localhost:3003/jane.jpg',
      'https://example.',
      'https://.com',
      'https://exa mple.com/jane.jpg',
    ]) {
      expect(authorInputSchema.safeParse({ ...valid, avatarUrl }).success).toBe(false);
    }
  });

  it('accepts ordinary domains and subdomains', () => {
    for (const avatarUrl of [
      'https://example.com',
      'https://cdn.assets.example.co.uk/jane.jpg?v=2',
      'http://example.io/a/b.png',
    ]) {
      expect(authorInputSchema.safeParse({ ...valid, avatarUrl }).success).toBe(true);
    }
  });

  it('rejects a slug that is not lowercase and URL-safe', () => {
    for (const slug of ['Jane Doe', 'jane_doe', 'jane--doe!', '']) {
      expect(authorInputSchema.safeParse({ ...valid, slug }).success).toBe(false);
    }
  });
});
