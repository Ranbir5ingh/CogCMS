import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SITE_B } from './support/fixtures';
import { adminGet, issueReadKey, publicGet } from './support/api';
import { confirmDelete, login, rowAction, selectSite, toast } from './support/session';

// Each test uses unique titles so reruns and retries never collide on slugs.
const unique = () => Date.now().toString(36);

async function typeInEditor(page: Page, text: string): Promise<void> {
  await page.locator('.ql-editor').first().click();
  await page.keyboard.type(text);
}

test.describe('content editors', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await selectSite(page);
  });

  test('FAQ: create, edit, and delete from the list', async ({ page }) => {
    const question = `How does e2e ${unique()} work?`;
    await page.goto('/admin/dashboard/faqs/new');
    await expect(page.getByRole('button', { name: 'Save FAQ' })).toBeDisabled();
    await page.getByLabel('Question').fill(question);
    await page.getByLabel('Answer').fill('It drives a real browser.');
    await page.getByRole('button', { name: 'Save FAQ' }).click();
    await expect(toast(page, 'FAQ saved.')).toBeVisible();

    await page.goto('/admin/dashboard/faqs');
    await expect(page.getByText(question)).toBeVisible();

    await rowAction(page, `Actions for FAQ: ${question}`, 'Edit');
    // Wait for the saved FAQ to load, or the load would overwrite the edit below.
    await expect(page.getByLabel('Question')).toHaveValue(question);
    await page.getByLabel('Answer').fill('It drives a real browser, end to end.');
    await page.getByRole('button', { name: 'Save FAQ' }).click();
    await expect(toast(page, 'FAQ saved.')).toBeVisible();
    const faqs = await adminGet<{ question: string; answer: string }[]>(page, 'faqs');
    expect(faqs.find((f) => f.question === question)?.answer).toBe(
      'It drives a real browser, end to end.',
    );

    await page.goto('/admin/dashboard/faqs');
    await rowAction(page, `Actions for FAQ: ${question}`, 'Delete');
    await confirmDelete(page);
    await expect(page.getByText(question)).toHaveCount(0);
  });

  test('author: create as draft, publish, and delete', async ({ page }) => {
    const name = `Ada ${unique()}`;
    await page.goto('/admin/dashboard/authors/new');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
    await page.getByRole('combobox', { name: 'Status' }).selectOption('draft');
    await page.getByRole('button', { name: 'Create author' }).click();
    await expect(toast(page, 'Author saved.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/dashboard\/authors$/);

    const authors = await adminGet<{ name: string; slug: string; status: string }[]>(
      page,
      'authors',
    );
    const created = authors.find((a) => a.name === name)!;
    expect(created.status).toBe('draft');

    await rowAction(page, `Actions for ${name}`, 'Edit');
    await page.getByRole('combobox', { name: 'Status' }).selectOption('publish');
    await page.getByRole('button', { name: 'Save author' }).click();
    await expect(toast(page, 'Author saved.')).toBeVisible();
    expect((await adminGet<{ status: string }>(page, `authors/${created.slug}`)).status).toBe(
      'publish',
    );

    await page.goto('/admin/dashboard/authors');
    await rowAction(page, `Actions for ${name}`, 'Delete');
    await confirmDelete(page);
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test('author: an invalid slug is flagged on the field', async ({ page }) => {
    await page.goto('/admin/dashboard/authors/new');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Bad Slug');
    await page.getByRole('textbox', { name: /^Slug/ }).fill('Not A Slug');
    await page.getByRole('button', { name: 'Create author' }).click();
    await expect(
      page.getByText('Slug must be lowercase letters, numbers and hyphens.').first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/authors\/new$/);
  });

  test('whitepaper: save draft, publish, and delete', async ({ page }) => {
    const id = unique();
    const title = `E2E Paper ${id}`;
    const slug = `e2e-paper-${id}`;
    await page.goto('/admin/dashboard/whitepapers/new');
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="slug"]').fill(slug);
    await page.locator('textarea[name="description"], input[name="description"]').fill('About e2e');
    await typeInEditor(page, 'Whitepaper body written in the real editor.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/whitepapers$/);
    expect((await adminGet<{ status: string }>(page, `whitepapers/${slug}`)).status).toBe('draft');

    await rowAction(page, `Actions for ${title}`, 'Edit');
    await expect(page.locator('input[name="title"]')).toHaveValue(title);
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/whitepapers$/);
    expect((await adminGet<{ status: string }>(page, `whitepapers/${slug}`)).status).toBe(
      'publish',
    );

    await rowAction(page, `Actions for ${title}`, 'Delete');
    await confirmDelete(page);
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test('release note: publish, unpublish via draft, and delete', async ({ page }) => {
    const major = Math.floor(Math.random() * 900) + 100;
    const version = `${major}.0`;
    const slug = `v${major}-0`;
    await page.goto('/admin/dashboard/release-notes/new');
    await page.locator('input[name="version"]').fill(version);
    await page.locator('input[name="date"]').fill('2026-09-25');
    await typeInEditor(page, 'Shipped end-to-end tests.');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/release-notes$/);
    expect((await adminGet<{ status: string }>(page, `release-notes/${slug}`)).status).toBe(
      'publish',
    );

    await rowAction(page, `Actions for release note ${version}`, 'Edit');
    await expect(page.locator('input[name="version"]')).toHaveValue(version);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/release-notes$/);
    expect((await adminGet<{ status: string }>(page, `release-notes/${slug}`)).status).toBe(
      'draft',
    );

    await rowAction(page, `Actions for release note ${version}`, 'Delete');
    await confirmDelete(page);
    await expect(page.getByText(`${version}`, { exact: true })).toHaveCount(0);
  });

  test('blog: publish, unpublish to draft, and delete', async ({ page }) => {
    const title = `E2E Blog ${unique()}`;
    await page.goto('/admin/dashboard/blogs/new');
    await page.getByPlaceholder('Title').fill(title);
    await page.getByPlaceholder('Tell readers what your story is about...').fill('An excerpt.');
    await typeInEditor(page, 'A blog post body typed into Quill.');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/blogs$/);

    const row = page.getByText(title);
    await expect(row).toBeVisible();
    const blogs = await adminGet<{ title: string; slug: string; status: string }[]>(page, 'blogs');
    const blog = blogs.find((b) => b.title === title)!;
    expect(blog.status).toBe('publish');

    await rowAction(page, `Actions for ${title}`, 'Edit');
    await expect(page.getByPlaceholder('Title')).toHaveValue(title);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(toast(page, 'Draft saved.')).toBeVisible();
    await expect
      .poll(async () => (await adminGet<{ status: string }>(page, `blogs/${blog.slug}`)).status)
      .toBe('draft');
    await page.goto('/admin/dashboard/blogs');

    await rowAction(page, `Actions for ${title}`, 'Delete');
    await confirmDelete(page);
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test('blog: publishing without a body is blocked in the editor', async ({ page }) => {
    await page.goto('/admin/dashboard/blogs/new');
    await page.getByPlaceholder('Title').fill(`Empty ${unique()}`);
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/blogs\/new$/);
  });
});

test.describe('publishing reaches the public API', () => {
  test('a published FAQ is served by /api/v1 for its own site only', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await selectSite(page);
    const question = `Public e2e ${unique()}?`;
    await page.goto('/admin/dashboard/faqs/new');
    await page.getByLabel('Question').fill(question);
    await page.getByLabel('Answer').fill('Visible to the website.');
    await page.getByRole('button', { name: 'Save FAQ' }).click();
    await expect(toast(page, 'FAQ saved.')).toBeVisible();

    const keyA = await issueReadKey(page);
    const served = await publicGet(page, 'faqs', keyA);
    expect(served.status()).toBe(200);
    const questions = (await served.json()).data.map((f: { question: string }) => f.question);
    expect(questions).toContain(question);

    await selectSite(page, SITE_B.name);
    const keyB = await issueReadKey(page);
    const other = await publicGet(page, 'faqs', keyB);
    expect((await other.json()).data.map((f: { question: string }) => f.question)).not.toContain(
      question,
    );
  });

  test('a request without an API key is refused', async ({ page }) => {
    const response = await page.request.get('/api/v1/faqs');
    expect(response.status()).toBe(401);
  });
});
