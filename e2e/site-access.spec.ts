import { expect, test } from '@playwright/test';
import { ADMIN, EDITOR, SITE_A, SITE_B } from './support/fixtures';
import { adminRequest } from './support/api';
import { login, rowAction, selectSite, toast } from './support/session';

test.describe('site access and roles', () => {
  test('an admin can switch between every active site', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const switcher = page.getByLabel('Working site');
    await expect(switcher.locator('option', { hasText: SITE_A.name })).toHaveCount(1);
    await expect(switcher.locator('option', { hasText: SITE_B.name })).toHaveCount(1);

    await selectSite(page, SITE_B.name);
    await expect(page.getByText(new URL(SITE_B.domain).host)).toBeVisible();
    await selectSite(page, SITE_A.name);
    await expect(page.getByText(new URL(SITE_A.domain).host)).toBeVisible();
  });

  test('content links stay disabled until a site is chosen', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const nav = page.getByRole('navigation', { name: 'CMS navigation' });
    const blogs = nav.getByText('Blogs', { exact: true });
    if ((await page.getByLabel('Working site').inputValue()) === '') {
      await expect(blogs).toHaveAttribute('aria-disabled', 'true');
    }
    await selectSite(page);
    await expect(nav.getByRole('link', { name: 'Blogs' })).toBeVisible();
  });

  test('an editor only sees their assigned site and no admin workspace', async ({ page }) => {
    await login(page, EDITOR.email, EDITOR.password);
    const switcher = page.getByLabel('Working site');
    await expect(switcher.locator('option', { hasText: SITE_A.name })).toHaveCount(1);
    await expect(switcher.locator('option', { hasText: SITE_B.name })).toHaveCount(0);

    const nav = page.getByRole('navigation', { name: 'CMS navigation' });
    await expect(nav.getByRole('link', { name: 'Sites' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
  });

  test('an editor is refused by the admin-only APIs behind those screens', async ({ page }) => {
    await login(page, EDITOR.email, EDITOR.password);
    for (const path of ['users', 'sites']) {
      expect((await adminRequest(page, path)).status, path).toBe(403);
    }
  });

  test('an admin can open the users and sites screens', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/admin/dashboard/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.getByText(EDITOR.email)).toBeVisible();

    await page.goto('/admin/dashboard/sites');
    await expect(page.getByRole('heading', { name: 'Sites' })).toBeVisible();
    await expect(page.getByRole('main').getByText(SITE_B.name, { exact: true })).toBeVisible();
  });
});

test.describe('website API keys', () => {
  test('an admin issues a key once, it reads the API, and revoking it cuts access', async ({
    page,
  }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/admin/dashboard/sites');
    await rowAction(page, `Actions for ${SITE_A.name}`, 'Edit');

    const name = `Website key ${Date.now().toString(36)}`;
    await page.getByLabel('Key name').fill(name);
    await page.getByRole('button', { name: 'Issue key' }).click();
    await expect(page.getByText('Copy this key now — it cannot be shown again.')).toBeVisible();
    const key = (await page.locator('code', { hasText: /^cms_/ }).first().textContent())!.trim();

    const allowed = await page.request.get('/api/v1/site', {
      headers: { authorization: `Bearer ${key}` },
    });
    expect(allowed.status()).toBe(200);
    expect((await allowed.json()).data.name).toBe(SITE_A.name);

    const row = page
      .locator('div')
      .filter({ hasText: name })
      .filter({ has: page.getByRole('button', { name: 'Revoke' }) })
      .last();
    await row.getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, revoke it' }).click();
    await expect(toast(page, 'API key revoked.')).toBeVisible();

    const refused = await page.request.get('/api/v1/site', {
      headers: { authorization: `Bearer ${key}` },
    });
    expect(refused.status()).toBe(401);
  });
});
