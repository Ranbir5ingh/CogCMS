import { expect, test } from '@playwright/test';
import { ADMIN, EDITOR } from './support/fixtures';
import { login, logout, toast } from './support/session';

test.describe('admin authentication', () => {
  test('redirects a signed-out visitor from any admin page to login', async ({ page }) => {
    for (const path of ['/admin/dashboard', '/admin/dashboard/blogs', '/admin/dashboard/users']) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/login$/);
    }
  });

  test('rejects a wrong password with a generic message', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(toast(page, 'Invalid email or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('validates the form before contacting the server', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  test('logs in, keeps the session across reloads, and logs out', async ({ page, context }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const cookie = (await context.cookies()).find((c) => c.name === 'cms_session');
    expect(cookie?.httpOnly).toBe(true);

    await page.reload();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

    await logout(page);
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('an editor can log in too', async ({ page }) => {
    await login(page, EDITOR.email, EDITOR.password);
    await expect(page.getByRole('navigation', { name: 'CMS navigation' })).toBeVisible();
  });
});
