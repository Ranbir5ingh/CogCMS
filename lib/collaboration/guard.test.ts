import { describe, expect, it } from 'vitest';
import { HttpError } from '@/lib/http/errors';
import { assertFreshWrite, takeExpectedUpdatedAt } from '@/lib/collaboration/guard';

describe('takeExpectedUpdatedAt', () => {
  it('returns a valid ISO timestamp and ignores an absent or empty value', () => {
    expect(takeExpectedUpdatedAt({ title: 'Hello' })).toBeUndefined();
    expect(takeExpectedUpdatedAt({ expectedUpdatedAt: '' })).toBeUndefined();
    expect(takeExpectedUpdatedAt({ expectedUpdatedAt: null })).toBeUndefined();
    expect(takeExpectedUpdatedAt(null)).toBeUndefined();
    expect(takeExpectedUpdatedAt('nope')).toBeUndefined();
    const iso = '2026-11-12T06:19:00.123Z';
    expect(takeExpectedUpdatedAt({ expectedUpdatedAt: iso, title: 'X' })).toBe(iso);
  });

  it('rejects a non-string or unparseable timestamp', () => {
    expect(() => takeExpectedUpdatedAt({ expectedUpdatedAt: 12 })).toThrow(HttpError);
    expect(() => takeExpectedUpdatedAt({ expectedUpdatedAt: 'last Tuesday' })).toThrow(
      /ISO-8601/,
    );
  });
});

describe('assertFreshWrite', () => {
  const updatedAt = new Date('2026-11-12T06:19:00.123Z');

  it('is a no-op when the client omitted a token', () => {
    expect(() => assertFreshWrite(updatedAt)).not.toThrow();
  });

  it('accepts a matching timestamp and rejects a stale one', () => {
    expect(() => assertFreshWrite(updatedAt, updatedAt.toISOString())).not.toThrow();
    try {
      assertFreshWrite(updatedAt, '2026-11-12T06:18:00.000Z');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const http = error as HttpError;
      expect(http.status).toBe(409);
      expect(http.code).toBe('CONFLICT');
      expect(http.details).toEqual({ updatedAt: updatedAt.toISOString() });
    }
  });
});
