import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isAllowedMediaUrl,
  isFirstPartyMediaUrl,
  optionalMediaUrlSchema,
} from '@/lib/validation/media';

const token = 'd'.repeat(32);
const mediaPath = `/media/sites/demo/2026-11-12/${token}.jpg`;
const mediaUrl = `http://localhost:3003${mediaPath}`;

describe('first-party media URLs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a CMS-origin library URL and a relative /media/ path', () => {
    vi.stubEnv('NEXT_PUBLIC_CMS_URL', 'http://localhost:3003');
    expect(isFirstPartyMediaUrl(mediaUrl)).toBe(true);
    expect(isFirstPartyMediaUrl(mediaPath)).toBe(true);
    expect(isAllowedMediaUrl(mediaUrl)).toBe(true);
    expect(optionalMediaUrlSchema.safeParse(mediaUrl).success).toBe(true);
    expect(optionalMediaUrlSchema.safeParse('').success).toBe(true);
    expect(optionalMediaUrlSchema.safeParse('https://cdn.example.com/cover.jpg').success).toBe(
      true,
    );
  });

  it('rejects localhost paths that are not finalized library keys', () => {
    vi.stubEnv('NEXT_PUBLIC_CMS_URL', 'http://localhost:3003');
    for (const value of [
      'http://localhost:3003/jane.jpg',
      'http://localhost:3003/media/../secret.jpg',
      `http://localhost:3003/media/staging/abc/${token}`,
      `http://localhost:3003/media/sites/demo/2026-11-12/${token}.jpg?x=1`,
      'javascript:alert(1)',
      '/etc/passwd',
    ]) {
      expect(isFirstPartyMediaUrl(value)).toBe(false);
      expect(optionalMediaUrlSchema.safeParse(value).success).toBe(false);
    }
    // A public host remains a valid pasted URL; it is just not first-party media.
    const external = `http://evil.example/media/sites/demo/2026-11-12/${token}.jpg`;
    expect(isFirstPartyMediaUrl(external)).toBe(false);
    expect(optionalMediaUrlSchema.safeParse(external).success).toBe(true);
  });

  it('requires the configured CMS origin, not a look-alike host', () => {
    vi.stubEnv('NEXT_PUBLIC_CMS_URL', 'https://cms.example.com');
    expect(isFirstPartyMediaUrl(`https://cms.example.com${mediaPath}`)).toBe(true);
    expect(isFirstPartyMediaUrl(`http://localhost:3003${mediaPath}`)).toBe(false);
  });
});
