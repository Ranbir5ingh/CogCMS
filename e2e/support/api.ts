import { expect, type Page } from '@playwright/test';

// API calls made with fetch() inside the page, so they carry the browser's session
// cookie exactly as the admin UI does. (The session cookie is `Secure` under
// `next start`; Playwright's standalone request client will not send it over http.)

type Result = { status: number; body: unknown };

async function browserFetch(page: Page, url: string, init?: RequestInit): Promise<Result> {
  return page.evaluate(
    async ({ url, init }) => {
      const response = await fetch(url, init);
      const text = await response.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {}
      return { status: response.status, body };
    },
    { url, init },
  );
}

export async function adminRequest(
  page: Page,
  path: string,
  method = 'GET',
  json?: unknown,
): Promise<Result> {
  return browserFetch(page, `/api/admin/${path}`, {
    method,
    headers: json === undefined ? undefined : { 'content-type': 'application/json' },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
}

export async function adminGet<T = unknown>(page: Page, path: string): Promise<T> {
  const { status, body } = await adminRequest(page, path);
  expect(status, path).toBe(200);
  return body as T;
}

async function currentSiteId(page: Page): Promise<string> {
  const session = await adminGet<{ currentSite: { id: string } | null }>(page, 'session');
  expect(session.currentSite).not.toBeNull();
  return session.currentSite!.id;
}

export async function issueReadKey(page: Page): Promise<string> {
  const siteId = await currentSiteId(page);
  const { status, body } = await adminRequest(page, `sites/${siteId}/api-keys`, 'POST', {
    name: `e2e ${Date.now()}`,
    scopes: ['content:read'],
  });
  expect(status).toBe(201);
  return (body as { plaintext: string }).plaintext;
}

export async function publicGet(page: Page, path: string, key: string) {
  return page.request.get(`/api/v1/${path}`, {
    headers: { authorization: `Bearer ${key}` },
  });
}
