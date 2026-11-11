import { describe, expect, it } from 'vitest';
import { formatBlogHTML } from './format-blog-html';

describe('formatBlogHTML', () => {
  it('returns an empty string for empty input', () => {
    expect(formatBlogHTML('')).toBe('');
  });

  it('replaces both encoded and decoded non-breaking spaces', () => {
    expect(formatBlogHTML('<p>a&nbsp;b c</p>')).toBe('<p>a b c</p>');
  });

  it('removes empty paragraphs', () => {
    expect(formatBlogHTML('<p>One</p><p> </p><p><br></p><p>Two</p>')).toBe('<p>One</p><p>Two</p>');
  });

  it('converts legacy divider paragraphs to <hr>', () => {
    expect(formatBlogHTML('<p class="ql-divider">---</p>')).toBe('<hr>');
  });

  it('promotes a "Table of Contents" paragraph to a heading', () => {
    expect(formatBlogHTML('<p>Table of Contents</p>')).toBe('<h2>Table of Contents</h2>');
  });
});
