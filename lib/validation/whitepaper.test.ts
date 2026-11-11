import { describe, expect, it } from 'vitest';
import {
  estimateWhitepaperReadTime,
  whitepaperInputSchema,
  whitepaperUpdateSchema,
} from './whitepaper';

const valid = { title: 'Guide', slug: 'guide', description: 'Desc', content: 'Body' };

describe('whitepaper validation', () => {
  it('requires title, slug, description, and content', () => {
    expect(whitepaperInputSchema.safeParse(valid).success).toBe(true);
    for (const field of ['title', 'slug', 'description', 'content'] as const) {
      const { [field]: _omitted, ...rest } = valid;
      expect(whitepaperInputSchema.safeParse(rest).success, field).toBe(false);
    }
  });

  it('rejects an unsafe slug and empty tags', () => {
    expect(whitepaperInputSchema.safeParse({ ...valid, slug: 'Bad Slug' }).success).toBe(false);
    expect(whitepaperInputSchema.safeParse({ ...valid, tags: [' '] }).success).toBe(false);
  });

  it('strips server-owned fields', () => {
    const parsed = whitepaperUpdateSchema.parse({ title: 'New', siteId: 'x', publishedAt: 'y' });
    expect(parsed).toEqual({ title: 'New' });
  });
});

describe('estimateWhitepaperReadTime', () => {
  it('never reports less than one minute', () => {
    expect(estimateWhitepaperReadTime('')).toBe('1 min read');
    expect(estimateWhitepaperReadTime('short')).toBe('1 min read');
  });

  it('counts visible words at about 238 per minute', () => {
    expect(estimateWhitepaperReadTime(Array(239).fill('word').join(' '))).toBe('2 min read');
  });

  it('ignores markup, scripts, and styles', () => {
    const hidden = `<script>${'x '.repeat(1000)}</script><style>${'y '.repeat(1000)}</style>`;
    expect(estimateWhitepaperReadTime(`${hidden}<p><strong>Hi</strong></p>`)).toBe('1 min read');
  });
});
