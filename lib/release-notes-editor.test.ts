import { describe, expect, it } from 'vitest';
import { editorHtmlToMarkdown, markdownToEditorHtml } from './release-notes-editor';

describe('release notes editor conversion', () => {
  it('turns release-note markdown into editor HTML', () => {
    expect(
      markdownToEditorHtml(
        'Intro\ncontinues\n\n## Added\n- **Bold** item\n- [Docs](https://x.io)\n\n### Fixed\n1. one\n2. two',
      ),
    ).toBe(
      '<p>Intro continues</p><h2>Added</h2><ul><li><strong>Bold</strong> item</li>' +
        '<li><a href="https://x.io" target="_blank" rel="noreferrer">Docs</a></li></ul>' +
        '<h3>Fixed</h3><ol><li>one</li><li>two</li></ol>',
    );
  });

  it('escapes raw HTML so markdown cannot inject markup', () => {
    expect(markdownToEditorHtml('<img src=x onerror=alert(1)>')).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
    );
  });

  it('returns empty output for empty input', () => {
    expect(markdownToEditorHtml('')).toBe('');
  });

  it('returns an empty string on the server where no DOM exists', () => {
    expect(editorHtmlToMarkdown('<p>Hi</p>')).toBe('');
  });
});
