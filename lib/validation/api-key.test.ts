import { describe, expect, it } from 'vitest';
import { issueApiKeySchema } from './api-key';

describe('API key issue validation', () => {
  it('accepts a named key with known scopes and parses the expiry', () => {
    const parsed = issueApiKeySchema.parse({
      name: ' Website ',
      scopes: ['content:read', 'intake:write'],
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(parsed.name).toBe('Website');
    expect(parsed.expiresAt).toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });

  it('rejects empty, unknown, or duplicated scopes', () => {
    for (const scopes of [[], ['admin'], ['content:read', 'content:read']]) {
      expect(issueApiKeySchema.safeParse({ name: 'Key', scopes }).success, String(scopes)).toBe(
        false,
      );
    }
  });

  it('rejects a blank name, a bad expiry, and extra fields', () => {
    const base = { name: 'Key', scopes: ['content:read'] };
    expect(issueApiKeySchema.safeParse({ ...base, name: ' ' }).success).toBe(false);
    expect(issueApiKeySchema.safeParse({ ...base, expiresAt: 'tomorrow' }).success).toBe(false);
    expect(issueApiKeySchema.safeParse({ ...base, siteId: 'other' }).success).toBe(false);
  });
});
