import { describe, expect, it } from 'vitest';
import { isPublicHttpUrl, requiredSourceTextSchema, slugSchema } from './common';

describe('common validation', () => {
  it('accepts lowercase URL-safe slugs and rejects everything else', () => {
    for (const slug of ['a', 'hello-world', 'v2-0-1', 'a1b2']) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(true);
    }
    for (const slug of [
      '',
      'Hello',
      'two words',
      '-lead',
      'trail-',
      'double--dash',
      'ünï',
      'a/b',
    ]) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(false);
    }
    expect(slugSchema.safeParse('a'.repeat(161)).success).toBe(false);
  });

  it('only treats http(s) URLs on a real domain as public', () => {
    for (const url of ['https://example.com', 'http://cdn.example.co.uk/a.png']) {
      expect(isPublicHttpUrl(url), url).toBe(true);
    }
    for (const url of [
      'example.com',
      'ftp://example.com',
      'javascript:alert(1)',
      'http://localhost:3003',
      'https://10.0.0.1',
      'https://intranet',
    ]) {
      expect(isPublicHttpUrl(url), url).toBe(false);
    }
  });

  it('rejects blank source text but keeps the original bytes', () => {
    expect(requiredSourceTextSchema.safeParse('   \n').success).toBe(false);
    expect(requiredSourceTextSchema.parse('  body\n')).toBe('  body\n');
  });
});
