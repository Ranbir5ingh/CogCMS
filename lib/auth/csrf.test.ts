import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { assertSameOrigin } from './csrf';

beforeEach(() => {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
  process.env.CMS_JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
  process.env.NEXT_PUBLIC_CMS_URL = 'https://cms.example.com';
  resetEnvCache();
});

function request(headers: Record<string, string>, method = 'POST'): NextRequest {
  return new NextRequest('http://internal:3003/api/admin/blogs', {
    method,
    headers: { host: 'internal:3003', ...headers },
  });
}

describe('assertSameOrigin', () => {
  it('allows same-host and configured-origin JSON with optional charset', () => {
    expect(() =>
      assertSameOrigin(
        request({
          origin: 'http://internal:3003',
          'content-type': 'application/json; charset=utf-8',
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        request({ origin: 'https://cms.example.com', 'content-type': 'application/json' }),
      ),
    ).not.toThrow();
  });

  it('uses Referer only when Origin is absent', () => {
    expect(() =>
      assertSameOrigin(
        request({
          referer: 'https://cms.example.com/admin/dashboard',
          'content-type': 'application/json',
        }),
      ),
    ).not.toThrow();
  });

  it('rejects cross-origin, absent source, and cross-site fetch metadata with 403', () => {
    const cases: Array<Record<string, string>> = [
      { origin: 'https://evil.example', 'content-type': 'application/json' },
      { 'content-type': 'application/json' },
      {
        origin: 'https://cms.example.com',
        'content-type': 'application/json',
        'sec-fetch-site': 'cross-site',
      },
    ];
    for (const headers of cases) {
      expect(() => assertSameOrigin(request(headers))).toThrowError(
        expect.objectContaining({ status: 403, code: 'FORBIDDEN' }),
      );
    }
  });

  it('rejects the wrong content type with 400', () => {
    expect(() =>
      assertSameOrigin(
        request({ origin: 'https://cms.example.com', 'content-type': 'text/plain' }),
      ),
    ).toThrowError(expect.objectContaining({ status: 400, code: 'VALIDATION_ERROR' }));
  });

  it('allows multipart only when selected while retaining the origin check', () => {
    const multipart = request({
      origin: 'https://cms.example.com',
      'content-type': 'multipart/form-data; boundary=abc',
    });
    expect(() => assertSameOrigin(multipart, 'multipart')).not.toThrow();
    expect(() => assertSameOrigin(multipart, 'json')).toThrowError(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('accepts JSON or text/plain when jsonOrText is selected', () => {
    const headers = { origin: 'https://cms.example.com' };
    expect(() =>
      assertSameOrigin(request({ ...headers, 'content-type': 'text/plain' }), 'jsonOrText'),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(request({ ...headers, 'content-type': 'application/json' }), 'jsonOrText'),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        request({ ...headers, 'content-type': 'multipart/form-data; boundary=abc' }),
        'jsonOrText',
      ),
    ).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('does not impose mutation headers on GET', () => {
    expect(() => assertSameOrigin(request({}, 'GET'))).not.toThrow();
  });
});
