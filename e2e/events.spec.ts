import { expect, test } from '@playwright/test';
import { ADMIN } from './support/fixtures';
import { issueReadKey, publicGet } from './support/api';
import { confirmDelete, login, selectSite, toast } from './support/session';

test('event editor shows the fields and live preview', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await selectSite(page);
  await page.goto('/admin/dashboard/events/new');
  await page.getByLabel('Event title').fill('x'.repeat(151));
  await expect(page.getByLabel('Event title')).toHaveValue('x'.repeat(150));
  await expect(page.getByText('Maximum 150 characters')).toBeVisible();
  await page.getByLabel('Event title').fill('Community gathering');
  await page.getByLabel('Ticket price').selectOption('free');
  await expect(page.getByRole('paragraph').filter({ hasText: /^Free$/ })).toBeVisible();
  await page.getByLabel('Summary').fill('x'.repeat(3100));
  await expect(page.getByLabel('Summary')).toHaveValue('x'.repeat(3000));
  await expect(page.getByText('3000/3000 characters')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Community gathering' })).toBeVisible();
  await expect(page.getByLabel('Start')).toBeVisible();
  await expect(page.getByLabel('Event format')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
  await page.screenshot({ path: 'test-results/events-editor.png', fullPage: true });
});

test('cover controls and scrollable description work on desktop and mobile', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await selectSite(page);
  await page.goto('/admin/dashboard/events/new');
  const editor = page.locator('.ql-editor');
  const initialHeight = await editor.evaluate((element) => element.clientHeight);
  expect(initialHeight).toBeGreaterThanOrEqual(100);
  await editor.fill(Array.from({ length: 50 }, (_, index) => `Line ${index + 1}`).join('\n'));
  await expect
    .poll(() => editor.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await editor.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => editor.evaluate((element) => element.clientHeight)).toBe(initialHeight);

  await page.getByRole('button', { name: 'Paste URL' }).click();
  await page.getByLabel('Image URL').fill('https://example.com/cover.png');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove cover' })).toBeVisible();
  await page.getByLabel('Image description').fill('Conference hall');
  await page.getByRole('button', { name: 'Remove cover' }).click();
  await expect(page.getByRole('button', { name: 'Choose image' })).toBeVisible();

  await page.route('**/api/admin/upload', (route) =>
    route.fulfill({
      json: {
        url: 'https://example.s3.us-east-1.amazonaws.com/',
        fields: {},
        ticket: 'test-ticket',
      },
    }),
  );
  await page.route('https://example.s3.us-east-1.amazonaws.com/', (route) =>
    route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }),
  );
  await page.route('**/api/admin/upload/complete', (route) =>
    route.fulfill({ json: { url: 'https://example.com/uploaded.png' } }),
  );
  await page
    .getByLabel('Upload cover image')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('test image') });
  await expect(page.getByRole('button', { name: 'Remove cover' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Remove cover' }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'test-results/events-editor-mobile.png', fullPage: true });
});

test('date pickers apply only when Set is clicked', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await selectSite(page);
  await page.goto('/admin/dashboard/events/new');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await start.click();
  const picker = page.getByRole('dialog', { name: 'Start date and time' });
  await picker.getByRole('button', { name: 'Month', exact: true }).click();
  await picker.getByRole('option', { name: 'December' }).click();
  await picker.getByRole('button', { name: 'Year', exact: true }).click();
  await picker.getByRole('option', { name: '2030', exact: true }).click();
  await picker.getByRole('button', { name: '2030-12-15' }).click();
  await picker.getByRole('button', { name: 'Hour', exact: true }).click();
  await picker.getByRole('option', { name: '02', exact: true }).click();
  await picker.getByRole('button', { name: 'Minute', exact: true }).click();
  await expect(
    picker.getByRole('listbox', { name: 'Minute options' }).getByRole('option'),
  ).toHaveCount(12);
  await expect(picker.getByRole('option', { name: '10', exact: true })).toBeVisible();
  await expect(picker.getByRole('option', { name: '15', exact: true })).toBeVisible();
  await picker.getByRole('option', { name: '30', exact: true }).click();
  await picker.getByRole('button', { name: 'AM or PM', exact: true }).click();
  await picker.getByRole('option', { name: 'PM', exact: true }).click();
  await picker.screenshot({ path: 'test-results/event-date-picker.png' });
  await picker.getByRole('button', { name: 'Set' }).click();
  await expect(picker).toBeHidden();
  await expect(start).toContainText('15 · 14:30');
  await start.click();
  await picker.getByRole('button', { name: /^\d{4}-\d{2}-16$/ }).click();
  await picker.getByRole('button', { name: 'Cancel' }).click();
  await expect(start).toContainText('15 · 14:30');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'End', exact: true }).click();
  const endPicker = page.getByRole('dialog', { name: 'End date and time' });
  await expect(endPicker).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await endPicker.getByRole('button', { name: /^\d{4}-\d{2}-16$/ }).click();
  await endPicker.getByRole('button', { name: 'Set' }).click();
  await expect(endPicker).toBeHidden();
  await expect(page.getByRole('button', { name: 'End', exact: true })).toContainText('16 · 09:00');
});

test('slug and URL fields show clear errors before saving', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await selectSite(page);
  await page.goto('/admin/dashboard/events/new');
  const slug = page.getByLabel('URL slug');
  await slug.fill('not a valid slug');
  await slug.blur();
  await expect(page.getByText('Use lowercase letters, numbers and hyphens only')).toBeVisible();
  await slug.fill('valid-event');
  await page.getByLabel('Online event URL').fill('not a url');
  await page.getByLabel('Registration URL').fill('not a url');
  await page.getByRole('button', { name: 'Publish event' }).click();
  await expect(page.getByText('Enter a valid URL starting with http:// or https://')).toHaveCount(
    2,
  );
  await expect(page.getByLabel('Online event URL')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Registration URL')).toHaveAttribute('aria-invalid', 'true');
  await page.screenshot({ path: 'test-results/event-url-validation.png', fullPage: true });
  await page.getByLabel('Online event URL').fill('https://example.com/join');
  await page.getByLabel('Registration URL').fill('https://example.com/register');
  await page.getByLabel('Registration URL').blur();
  await page
    .getByLabel('Online event URL')
    .fill('http://localhost:3003/admin/dashboard/events/new');
  await page.getByLabel('Registration URL').fill('http://localhost:3003/register');
  await page.getByLabel('Registration URL').blur();
  await expect(page.getByLabel('Online event URL')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByLabel('Registration URL')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByText('Enter a valid URL starting with http:// or https://')).toHaveCount(
    0,
  );
});

test('events list uses the shared actions menu and shows save and delete toasts', async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await selectSite(page);
  await page.goto('/admin/dashboard/events/new');
  const id = Date.now().toString(36);
  const title = `Event ${id}`;
  await page.getByLabel('Event title').fill(title);
  await page.getByLabel('URL slug').fill(`event-${id}`);
  await page.locator('.ql-editor').fill('Event details');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const start = page.getByRole('dialog', { name: 'Start date and time' });
  await start.getByRole('button', { name: /^\d{4}-\d{2}-15$/ }).click();
  await start.getByRole('button', { name: 'Set' }).click();
  await page.getByRole('button', { name: 'End', exact: true }).click();
  const end = page.getByRole('dialog', { name: 'End date and time' });
  await end.getByRole('button', { name: /^\d{4}-\d{2}-16$/ }).click();
  await end.getByRole('button', { name: 'Set' }).click();
  await page.getByLabel('Online event URL').fill('https://example.com/event');
  await page.getByLabel('Ticket price').selectOption('paid');
  await expect(page.getByRole('button', { name: 'Currency code' })).toContainText('INR');
  await page.getByLabel('Amount', { exact: true }).fill('49abc.50');
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('49.50');
  await page.getByLabel('Amount', { exact: true }).fill('499.50');
  await page.getByRole('button', { name: 'Currency code' }).click();
  await page.screenshot({ path: 'test-results/event-currency-dropdown.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Search currencies' }).fill('INR');
  await page.getByRole('button', { name: 'INR', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Currency code' })).toContainText('INR');
  await expect(page.getByText('INR 499.50')).toBeVisible();
  const amountBox = await page.getByLabel('Amount', { exact: true }).locator('..').boundingBox();
  const currencyBox = await page.getByLabel('Currency code').locator('..').boundingBox();
  expect(amountBox?.height).toBe(currencyBox?.height);
  await page.screenshot({ path: 'test-results/event-paid-price.png', fullPage: true });
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/events$/);
  await expect(toast(page, 'Event draft saved.')).toBeVisible();
  await page.getByLabel('Search events').fill(title);
  await expect(page.getByText('1 of 1 events')).toBeVisible();
  await page.getByRole('button', { name: `Actions for ${title}` }).click();
  await expect(page.getByRole('menu').getByRole('link', { name: 'Edit' })).toBeVisible();
  await page.screenshot({ path: 'test-results/events-list.png', fullPage: true });
  await page.getByRole('menu').getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByLabel('Event title')).toHaveValue(title);
  await page.getByLabel('Summary').fill('Unsaved edit');
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel('Summary')).toHaveValue('Unsaved edit');
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('499.50');
  await expect(page.getByRole('button', { name: 'Currency code' })).toContainText('INR');
  const key = await issueReadKey(page);
  await page.getByRole('button', { name: 'Publish event' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/events$/);
  const response = await publicGet(page, `events/event-${id}`, key);
  expect(response.status()).toBe(200);
  expect((await response.json()).data).toMatchObject({
    ticketPriceType: 'paid',
    ticketPriceAmount: '499.50',
    ticketPriceCurrency: 'INR',
  });
  await page.getByRole('button', { name: `Actions for ${title}` }).click();
  await page.getByRole('menu').getByRole('button', { name: 'Delete' }).click();
  await confirmDelete(page);
  await expect(toast(page, 'Event deleted.')).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test('unsaved event fields survive refresh and a failed save', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await selectSite(page);
  await page.goto('/admin/dashboard/events/new');
  await page.getByLabel('Event title').fill('Recovery test');
  await page.getByLabel('URL slug').fill('recovery-test');
  await page.getByLabel('Summary').fill('Unsaved summary');
  await page.locator('.ql-editor').fill('Unsaved description');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const start = page.getByRole('dialog', { name: 'Start date and time' });
  await start.getByRole('button', { name: /^\d{4}-\d{2}-15$/ }).click();
  await start.getByRole('button', { name: 'Set' }).click();
  await page.getByRole('button', { name: 'End', exact: true }).click();
  const end = page.getByRole('dialog', { name: 'End date and time' });
  await end.getByRole('button', { name: /^\d{4}-\d{2}-16$/ }).click();
  await end.getByRole('button', { name: 'Set' }).click();
  await page.getByLabel('Online event URL').fill('https://example.com/event');
  await page.getByLabel('Registration URL').fill('https://example.com/register');
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel('Event title')).toHaveValue('Recovery test');
  await expect(page.getByLabel('Summary')).toHaveValue('Unsaved summary');
  await expect(page.locator('.ql-editor')).toContainText('Unsaved description');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toContainText(
    '15 · 09:00',
  );
  await expect(page.getByLabel('Registration URL')).toHaveValue('https://example.com/register');
  await page.route('**/api/admin/events', (route) =>
    route.request().method() === 'POST' ? route.abort('failed') : route.continue(),
  );
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(toast(page, /failed to fetch|load failed|network/i)).toBeVisible();
  await expect(page.getByLabel('Event title')).toHaveValue('Recovery test');
  await page.reload();
  await expect(page.getByLabel('Event title')).toHaveValue('Recovery test');
  await expect(page.locator('.ql-editor')).toContainText('Unsaved description');
});
