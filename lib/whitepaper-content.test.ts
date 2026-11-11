import { describe, expect, it } from 'vitest';
import { contentToBlocks, parseBlocks } from './whitepaper-content';

describe('whitepaper content blocks', () => {
  it('parses headings, lists, dividers, and paragraphs from markdown', () => {
    const blocks = parseBlocks(
      '# Title\n\n## Section\n\n### Sub\n\nFirst line\nsecond line\n\n- a\n- b\n\n1. one\n2. two\n\n---',
    );
    expect(blocks).toEqual([
      { type: 'h1', text: 'Title' },
      { type: 'h2', text: 'Section' },
      { type: 'h3', text: 'Sub' },
      { type: 'paragraph', text: 'First line\nsecond line' },
      { type: 'ul', items: ['a', 'b'] },
      { type: 'ol', items: ['one', 'two'] },
      { type: 'divider' },
    ]);
  });

  it('parses a table and skips the separator row', () => {
    expect(parseBlocks('| Name | Value |\n| --- | --- |\n| A | 1 |')).toEqual([
      { type: 'table', headers: ['Name', 'Value'], rows: [['A', '1']] },
    ]);
  });

  it('returns no blocks for empty content', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(contentToBlocks('  \n ')).toEqual([]);
  });

  it('converts editor HTML to the same blocks and drops scripts', () => {
    const blocks = contentToBlocks(
      '<h2>Why</h2><p>Because &amp; so</p><ul><li>x</li><li>y</li></ul><script>alert(1)</script>',
    );
    expect(blocks).toEqual([
      { type: 'h2', text: 'Why' },
      { type: 'paragraph', text: 'Because & so' },
      { type: 'ul', items: ['x', 'y'] },
    ]);
  });
});
