import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { ADMIN, EDITOR } from './support/fixtures';
import { adminGet, adminRequest } from './support/api';
import { login, selectSite, toast } from './support/session';

const SHOTS = path.join(process.cwd(), 'docs', 'screenshots');
async function jpegFile(name: string, color: { r: number; g: number; b: number }): Promise<string> {
  const file = path.join(os.tmpdir(), name);
  await sharp({ create: { width: 960, height: 640, channels: 3, background: color } })
    .jpeg({ quality: 85 })
    .toFile(file);
  return file;
}

async function shot(page: Page, name: string, options: { fullPage?: boolean } = {}) {
  await mkdir(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, name),
    fullPage: options.fullPage ?? true,
    animations: 'disabled',
  });
}

test.describe('assignment screenshots', () => {
  test('media library, picker, presence, lock banner and comments', async ({ browser }) => {
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const editorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const admin = await adminContext.newPage();
    const editor = await editorContext.newPage();

    await login(admin, ADMIN.email, ADMIN.password);
    await selectSite(admin);
    await login(editor, EDITOR.email, EDITOR.password);
    await selectSite(editor);

    const sunrise = await jpegFile('fixture-sunrise.jpg', { r: 232, g: 118, b: 54 });
    const river = await jpegFile('fixture-river.jpg', { r: 40, g: 90, b: 140 });

    await admin.goto('/admin/dashboard/media');
    await expect(admin.getByRole('heading', { name: 'Media library' })).toBeVisible();
    await admin.getByLabel('Upload an image').setInputFiles(sunrise);
    await expect(admin.getByText('fixture-sunrise.jpg')).toBeVisible();
    await expect(admin.getByText('Missing alt')).toBeVisible();
    await admin.getByRole('button', { name: 'Edit alt' }).click();
    await admin.getByPlaceholder(/sailing boat/i).fill('A warm sunrise over terracotta rooftops.');
    await shot(admin, 'media-library-alt-editor.png', { fullPage: false });
    await admin.getByRole('button', { name: 'Save alt text' }).click();
    await expect(toast(admin, /alt/i)).toBeVisible();
    await admin.getByLabel('Upload an image').setInputFiles(river);
    await expect(admin.getByText('fixture-river.jpg')).toBeVisible();
    await expect(admin.getByText('Image added to the library.')).toHaveCount(0, { timeout: 8_000 });
    await expect(admin.getByText('Alt text saved.')).toHaveCount(0, { timeout: 1_000 });
    await shot(admin, 'media-library.png');

    const title = 'Harbour morning';
    const slug = 'harbour-morning';
    const created = await adminRequest(admin, 'blogs', 'POST', {
      title,
      slug,
      excerpt: 'A walk along the quay at first light.',
      content: '<p>The tide is out and the boats lean on the mud.</p>',
      status: 'draft',
    });
    expect(created.status).toBe(201);

    await admin.goto(`/admin/dashboard/blogs/new?slug=${slug}`);
    await expect(admin.getByPlaceholder('Title')).toHaveValue(title);
    await expect(admin.getByText('You are editing this document')).toBeVisible({ timeout: 15_000 });

    await admin.getByText('Add a cover image').click();
    await expect(admin.getByText('Choose a cover image')).toBeVisible();
    await expect(admin.getByRole('dialog').getByText('fixture-sunrise.jpg')).toBeVisible();
    await shot(admin, 'media-picker.png', { fullPage: false });
    await admin.keyboard.press('Escape');
    await expect(admin.getByText('Choose a cover image')).toHaveCount(0);

    // Comments as the holder
    await admin.getByRole('button', { name: 'Comments' }).click();
    await expect(admin.getByRole('dialog', { name: 'Comments' })).toBeVisible();
    await admin.getByPlaceholder(/Leave a comment/i).fill('Let’s lead with the quay photograph.');
    await admin.getByRole('button', { name: 'Post comment' }).click();
    await expect(admin.getByText('Let’s lead with the quay photograph.')).toBeVisible();
    await shot(admin, 'collaboration-comments.png', { fullPage: false });

    // Second editor joins — should see the lock and presence
    await editor.goto(`/admin/dashboard/blogs/new?slug=${slug}`);
    await expect(editor.getByPlaceholder('Title')).toHaveValue(title);
    await expect(editor.getByText(/is currently editing this document/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(editor.getByRole('button', { name: 'Take over editing' })).toBeVisible();
    await shot(editor, 'collaboration-lock-banner.png', { fullPage: false });

    await adminContext.close();
    await editorContext.close();
  });
});
