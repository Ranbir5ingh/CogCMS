import { expect, type Page } from '@playwright/test';
import { SITE_A } from './fixtures';

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

/** Admins see every site, so pick the working site explicitly before content work. */
export async function selectSite(page: Page, siteName = SITE_A.name): Promise<void> {
  const switcher = page.getByLabel('Working site');
  const selected = await switcher.locator('option:checked').textContent();
  if (selected?.trim() === siteName) return;
  await switcher.selectOption({ label: siteName });
  await expect(switcher.locator('option:checked')).toHaveText(siteName);
}

/** Opens a row's "⋯" menu and clicks an item in it. */
export async function rowAction(page: Page, rowLabel: string, item: string): Promise<void> {
  await page.getByRole('button', { name: rowLabel }).click();
  await page.getByRole('menu').getByText(item, { exact: true }).click();
}

export async function confirmDelete(page: Page): Promise<void> {
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, delete it' }).click();
}

/** Toasts use role=status (success) or role=alert (error); Next adds an empty alert too. */
export function toast(page: Page, text: string | RegExp) {
  return page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first();
}

export async function logout(page: Page): Promise<void> {
  await page.locator('details summary').filter({ hasText: '@' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
}
