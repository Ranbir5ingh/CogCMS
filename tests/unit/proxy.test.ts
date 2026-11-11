import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import proxy, { config } from '@/proxy';

const SECRET = 'proxy-test-secret-proxy-test-secret-1234';

async function token(secret = SECRET, expiresIn = '1h'): Promise<string> {
  return new SignJWT({ sub: 'user-1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

function request(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', `cms_session=${cookie}`);
  return new NextRequest(`http://localhost:3003${path}`, { headers });
}

function isRedirectToLogin(response: Response): boolean {
  return (
    response.status === 307 &&
    response.headers.get('location') === 'http://localhost:3003/admin/login'
  );
}

describe('admin page proxy', () => {
  beforeEach(() => vi.stubEnv('CMS_JWT_SECRET', SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it('only matches admin pages, leaving /api/admin to the route handlers', () => {
    expect(config.matcher).toEqual(['/admin/:path*']);
  });

  it('redirects to login and clears the cookie when there is no valid session', async () => {
    for (const cookie of [
      undefined,
      'garbage',
      await token('wrong-secret-wrong-secret-wrong-12'),
    ]) {
      const response = await proxy(request('/admin/dashboard', cookie));
      expect(isRedirectToLogin(response), String(cookie)).toBe(true);
      expect(response.headers.get('set-cookie')).toMatch(/cms_session=;/);
    }
  });

  it('redirects an expired session', async () => {
    const expired = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));
    expect(isRedirectToLogin(await proxy(request('/admin/dashboard/blogs', expired)))).toBe(true);
  });

  it('redirects every admin page when the server has no signing secret', async () => {
    const valid = await token();
    vi.stubEnv('CMS_JWT_SECRET', '');
    expect(isRedirectToLogin(await proxy(request('/admin/dashboard', valid)))).toBe(true);
  });

  it('lets a validly signed session through to admin pages', async () => {
    const response = await proxy(request('/admin/dashboard', await token()));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('never redirects the login page itself, even without a session', async () => {
    const response = await proxy(request('/admin/login'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
