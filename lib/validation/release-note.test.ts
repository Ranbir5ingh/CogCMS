import { describe, expect, it } from 'vitest';
import { releaseNoteInputSchema, releaseNoteUpdateSchema } from './release-note';

const valid = { version: '1.2.0', date: '2026-09-25', bodyMarkdown: '## Added\n- X' };

describe('release note validation', () => {
  it('accepts dot-separated numeric versions only', () => {
    for (const version of ['1', '1.2', '10.0.3']) {
      expect(releaseNoteInputSchema.safeParse({ ...valid, version }).success, version).toBe(true);
    }
    for (const version of ['', 'v1.2', '1.2-beta', '1..2', '1.']) {
      expect(releaseNoteInputSchema.safeParse({ ...valid, version }).success, version).toBe(false);
    }
  });

  it('accepts only real YYYY-MM-DD dates', () => {
    for (const date of ['2026-13-01', '2026-02-30', '25/09/2026', '2026-9-5', '']) {
      expect(releaseNoteInputSchema.safeParse({ ...valid, date }).success, date).toBe(false);
    }
  });

  it('rejects a blank body but keeps markdown whitespace intact', () => {
    expect(releaseNoteInputSchema.safeParse({ ...valid, bodyMarkdown: '  ' }).success).toBe(false);
    expect(releaseNoteInputSchema.parse({ ...valid, bodyMarkdown: '  - x\n' }).bodyMarkdown).toBe(
      '  - x\n',
    );
  });

  it('allows partial updates but still validates provided fields', () => {
    expect(releaseNoteUpdateSchema.safeParse({ status: 'draft' }).success).toBe(true);
    expect(releaseNoteUpdateSchema.safeParse({ version: 'latest' }).success).toBe(false);
  });
});
