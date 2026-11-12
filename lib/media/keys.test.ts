import { describe, expect, it } from 'vitest';
import {
  SAFE_MEDIA_KEY,
  assertSafeMediaKey,
  buildOriginalKey,
  buildVariantKey,
  mediaTokenFromKey,
  safeOriginalName,
} from '@/lib/media/keys';
import { HttpError } from '@/lib/http/errors';

describe('media object keys', () => {
  it('builds a dated, unguessable, per-site original key from the MIME type', () => {
    const key = buildOriginalKey(
      'Harbor Notes',
      'image/jpeg',
      new Date('2026-11-12T08:00:00.000Z'),
      'a'.repeat(32),
    );
    expect(key).toBe(`sites/harbor-notes/2026-11-12/${'a'.repeat(32)}.jpg`);
    expect(SAFE_MEDIA_KEY.test(key)).toBe(true);
    expect(assertSafeMediaKey(key)).toBe(key);
    expect(mediaTokenFromKey(key)).toBe('a'.repeat(32));
    expect(buildVariantKey(key, 'thumbnail')).toBe(
      `sites/harbor-notes/2026-11-12/${'a'.repeat(32)}-thumbnail.webp`,
    );
    expect(SAFE_MEDIA_KEY.test(buildVariantKey(key, 'large'))).toBe(true);
  });

  it('rejects staging keys, traversal, and unsuffixed paths', () => {
    for (const key of [
      'staging/aaaaaaaaaaaaaaaaaaaaaaaa/bbbb',
      'sites/../etc/passwd',
      'sites/site/2026-11-12/not-hex.jpg',
      'sites/site/2026-11-12/' + 'a'.repeat(32) + '.svg',
      'sites/site/2026-11-12/' + 'a'.repeat(32) + '-hero.webp',
      '../../../data/media/secret.jpg',
      '',
    ]) {
      expect(SAFE_MEDIA_KEY.test(key)).toBe(false);
      expect(() => assertSafeMediaKey(key)).toThrow(HttpError);
    }
  });

  it('sanitizes an original filename without using it as a storage key', () => {
    expect(safeOriginalName('../../etc/passwd.jpg')).toBe('passwd.jpg');
    expect(safeOriginalName('  My Photo (1).PNG  ')).toBe('My Photo (1).PNG');
    expect(safeOriginalName('a+b special.jpg')).toBe('a+b special.jpg');
    expect(safeOriginalName('')).toBe('image');
  });
});
