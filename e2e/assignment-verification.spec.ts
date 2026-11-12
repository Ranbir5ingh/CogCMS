import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { ADMIN, ADMIN_B, SITE_B } from './support/fixtures';
import { adminGet, adminRequest, issueReadKey, publicGet } from './support/api';
import { login, selectSite, toast } from './support/session';

const TMP = path.join(os.tmpdir(), 'cogcms-assignment-e2e');

async function raster(
  name: string,
  format: 'jpeg' | 'png' | 'webp' | 'gif' | 'avif',
  width = 640,
  height = 400,
  color: { r: number; g: number; b: number } = { r: 40, g: 90, b: 160 },
): Promise<{ file: string; name: string; mime: string }> {
  await mkdir(TMP, { recursive: true });
  const file = path.join(TMP, name);
  const image = sharp({ create: { width, height, channels: 3, background: color } });
  const mime =
    format === 'jpeg'
      ? 'image/jpeg'
      : format === 'png'
        ? 'image/png'
        : format === 'webp'
          ? 'image/webp'
          : format === 'gif'
            ? 'image/gif'
            : 'image/avif';
  if (format === 'jpeg') await image.jpeg({ quality: 85 }).toFile(file);
  else if (format === 'png') await image.png().toFile(file);
  else if (format === 'webp') await image.webp({ quality: 80 }).toFile(file);
  else if (format === 'gif') await image.gif().toFile(file);
  else await image.avif({ quality: 50 }).toFile(file);
  return { file, name, mime };
}

function attachConsole(page: Page, bag: { errors: string[]; warnings: string[] }) {
  page.on('console', (message: ConsoleMessage) => {
    const text = message.text();
    if (message.type() === 'error') bag.errors.push(text);
    if (message.type() === 'warning') bag.warnings.push(text);
  });
  page.on('pageerror', (error) => bag.errors.push(error.message));
}

function notable(messages: string[]): string[] {
  return messages.filter((text) => {
    const lower = text.toLowerCase();
    if (lower.includes('download the react devtools')) return false;
    if (lower.includes('unrecognized feature')) return false;
    if (lower.includes('collaboration/stream')) return false;
    if (lower.includes('net::err')) return false;
    if (lower.includes('failed to fetch') || lower.includes('load failed')) return false;
    if (lower.includes('the operation was aborted')) return false;
    // Chrome logs HTTP error statuses from fetch/EventSource; 409 is a normal
    // lock conflict, and 401/404 show up when a tab closes or the site is switched.
    if (
      lower.includes('failed to load resource') &&
      (lower.includes('400') ||
        lower.includes('401') ||
        lower.includes('404') ||
        lower.includes('409') ||
        lower.includes('500'))
    ) {
      return false;
    }
    if (lower.includes('cannot register "bullet"')) return false;
    return true;
  });
}

async function uploadFile(page: Page, file: string) {
  await page.getByLabel('Upload an image').setInputFiles(file);
}

test.describe.configure({ mode: 'serial' });

test.describe('assignment end-to-end verification', () => {
  const consoleBag = { errors: [] as string[], warnings: [] as string[] };

  test('media library: formats, rejection, variants, alt, search, pagination, delete', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    attachConsole(page, consoleBag);
    await login(page, ADMIN.email, ADMIN.password);
    await selectSite(page);

    await page.goto('/admin/dashboard/media');
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    // Empty state: a search that cannot match, whether or not earlier e2e files
    // already uploaded images into this shared in-memory database.
    await page.getByPlaceholder('Search by file name or alt text').fill('zz-no-such-image-zz');
    await page.getByPlaceholder('Search by file name or alt text').press('Enter');
    await expect(page.getByText(/No images match that search/i)).toBeVisible();
    await page.getByPlaceholder('Search by file name or alt text').fill('');
    await page.getByPlaceholder('Search by file name or alt text').press('Enter');

    const jpeg = await raster('harbour.jpg', 'jpeg', 960, 640, { r: 232, g: 118, b: 54 });
    const png = await raster('quay.png', 'png', 800, 500, { r: 20, g: 80, b: 130 });
    const webp = await raster('sail.webp', 'webp', 720, 480, { r: 80, g: 140, b: 90 });
    const gif = await raster('flag.gif', 'gif', 320, 240, { r: 200, g: 60, b: 60 });
    const avif = await raster('dusk.avif', 'avif', 640, 400, { r: 90, g: 50, b: 120 });

    await uploadFile(page, jpeg.file);
    await expect(page.getByText('harbour.jpg')).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'harbour.jpg' }).getByText('Missing alt'),
    ).toBeVisible();

    await uploadFile(page, png.file);
    await expect(page.getByText('quay.png')).toBeVisible();
    await uploadFile(page, webp.file);
    await expect(page.getByText('sail.webp')).toBeVisible();
    await uploadFile(page, gif.file);
    await expect(page.getByText('flag.gif')).toBeVisible();
    await uploadFile(page, avif.file);
    await expect(page.getByText('dusk.avif')).toBeVisible();

    const svg = path.join(TMP, 'evil.svg');
    await writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await uploadFile(page, svg);
    await expect(
      toast(
        page,
        /jpeg|png|webp|gif|avif|could not upload|only image|not a supported|rejected|invalid|unsupported|failed to process/i,
      ),
    ).toBeVisible();

    const pdf = path.join(TMP, 'note.pdf');
    await writeFile(pdf, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n');
    await uploadFile(page, pdf);
    await expect(
      toast(
        page,
        /jpeg|png|webp|gif|avif|could not upload|only image|not a supported|rejected|invalid|unsupported|failed to process/i,
      ),
    ).toBeVisible();

    const huge = path.join(TMP, 'huge.webp');
    const hugeBuf = Buffer.alloc(10 * 1024 * 1024 + 2048);
    Buffer.from('RIFF').copy(hugeBuf, 0);
    hugeBuf.writeUInt32LE(hugeBuf.length - 8, 4);
    Buffer.from('WEBPVP8 ').copy(hugeBuf, 8);
    await writeFile(huge, hugeBuf);
    await uploadFile(page, huge);
    await expect(toast(page, /too large|could not upload|must be|10/i)).toBeVisible({
      timeout: 15_000,
    });

    // Variants and headers for the JPEG we uploaded (list it via the API).
    const list = await adminGet<{
      data: {
        originalName: string;
        alt: string;
        id: string;
        sizes: Record<string, { url: string; mimeType: string; width: number; height: number }>;
      }[];
    }>(page, 'media?limit=50');
    const harbour = list.data.find((item) => item.originalName === 'harbour.jpg');
    expect(harbour).toBeTruthy();
    for (const size of ['original', 'thumbnail', 'medium', 'large'] as const) {
      const url = harbour!.sizes[size]!.url;
      expect(url).toBeTruthy();
      const response = await page.request.get(url);
      expect(response.status(), `${size} ${url}`).toBe(200);
      expect(response.headers()['x-content-type-options']).toBe('nosniff');
      expect(response.headers()['cache-control']).toMatch(/immutable/);
      expect(response.headers()['content-type']).toMatch(/image\//);
      expect(Number(response.headers()['content-length'])).toBeGreaterThan(0);
    }

    // Alt edit, with keyboard Escape after opening to verify the dialog, then save.
    await page
      .getByText('harbour.jpg')
      .locator('..')
      .getByRole('button', { name: 'Edit alt' })
      .click();
    const altDialog = page.getByRole('dialog', { name: /Alt text for harbour/i });
    await expect(altDialog).toBeVisible();
    await expect(altDialog.getByText(/screen reader/i)).toBeVisible();
    await altDialog.getByRole('textbox').fill('A warm sunrise over the harbour wall.');
    await altDialog.getByRole('button', { name: 'Save alt text' }).click();
    await expect(page.getByText('A warm sunrise over the harbour wall.')).toBeVisible();

    await page.getByPlaceholder('Search by file name or alt text').fill('harbour');
    await page.getByPlaceholder('Search by file name or alt text').press('Enter');
    await expect(page.getByText('harbour.jpg')).toBeVisible();
    await expect(page.getByText('quay.png')).toHaveCount(0);
    await page.getByPlaceholder('Search by file name or alt text').fill('');
    await page.getByPlaceholder('Search by file name or alt text').press('Enter');
    await expect(page.getByText('quay.png')).toBeVisible();

    // Pagination: seed enough images via the API to pass one page (24).
    const seed = await raster('page-seed.png', 'png', 80, 60, { r: 10, g: 10, b: 10 });
    const currentSite = (await adminGet<{ currentSite: { id: string } }>(page, 'session'))
      .currentSite.id;
    const seedBytes = [...(await (await import('node:fs/promises')).readFile(seed.file))];
    const seedStatuses = await page.evaluate(
      async ({ siteId, bytes, count }) => {
        const statuses: number[] = [];
        for (let i = 0; i < count; i++) {
          const form = new FormData();
          form.append(
            'file',
            new File([new Uint8Array(bytes)], `seed-${i}.png`, { type: 'image/png' }),
          );
          form.append('alt', `Seed seed-${i}.png`);
          const response = await fetch('/api/admin/media', {
            method: 'POST',
            headers: { 'x-cms-site': siteId },
            body: form,
          });
          statuses.push(response.status);
        }
        return statuses;
      },
      { siteId: currentSite, bytes: seedBytes, count: 22 },
    );
    expect(
      seedStatuses.every((status) => status === 201),
      String(seedStatuses),
    ).toBe(true);
    await page.goto('/admin/dashboard/media');
    await expect(page.getByText(/page 1 of/i)).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(/page 2 of/i)).toBeVisible();
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.getByText(/page 1 of/i)).toBeVisible();

    // Delete unused (the gif, if it's on page 1 — search for it).
    await page.getByPlaceholder('Search by file name or alt text').fill('flag.gif');
    await page.getByPlaceholder('Search by file name or alt text').press('Enter');
    await expect(page.getByText('flag.gif')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete image' }).click();
    await expect(toast(page, /deleted/i)).toBeVisible();
    await expect(page.getByText('flag.gif')).toHaveCount(0);

    // In-use delete: attach harbour to a blog, then refuse the delete.
    const blogs = await adminRequest(page, 'blogs', 'POST', {
      title: 'Harbour walk',
      slug: 'harbour-walk',
      excerpt: 'Along the wall.',
      content: '<p>The tide is out.</p>',
      imageUrl: harbour!.sizes.large.url,
      imageAlt: 'A warm sunrise over the harbour wall.',
      status: 'publish',
    });
    expect(blogs.status).toBe(201);
    await page.getByPlaceholder('Search by file name or alt text').fill('harbour.jpg');
    await page.getByPlaceholder('Search by file name or alt text').press('Enter');
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete image' }).click();
    await expect(toast(page, /still used|in use|cannot/i)).toBeVisible();
    await expect(page.getByRole('alertdialog').getByText(/Harbour walk|blog/i)).toBeVisible();
    await page.keyboard.press('Escape');

    // Error and retry: force the list to fail, then recover.
    await page.route('**/api/admin/media?**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'boom', code: 'INTERNAL_ERROR' }),
        });
      }
      return route.continue();
    });
    await page.getByPlaceholder('Search by file name or alt text').fill('quay');
    await page.getByPlaceholder('Search by file name or alt text').press('Enter');
    await expect(page.locator('p').filter({ hasText: 'boom' })).toBeVisible();
    await expect(toast(page, /could not load the media library/i)).toBeVisible();
    await page.unroute('**/api/admin/media?**');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('quay.png')).toBeVisible();

    // Loading state: delay the list just long enough to see the placeholder.
    await page.route('**/api/admin/media?**', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });
    const loadingNav = page.goto('/admin/dashboard/media');
    await expect(page.getByText('Loading images…')).toBeVisible({ timeout: 5_000 });
    await loadingNav;
    await expect(page.getByText('seed-21.png', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.unroute('**/api/admin/media?**');

    // Mobile width: the library should not force a horizontal page scroll.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/dashboard/media');
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    const scroll = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }));
    expect(scroll.doc).toBeLessThanOrEqual(scroll.view + 8);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('pickers persist on blog, event, author and whitepaper, and the public API serves the image', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    attachConsole(page, consoleBag);
    await login(page, ADMIN.email, ADMIN.password);
    await selectSite(page);

    const cover = await raster('cover-pick.jpg', 'jpeg', 1280, 720, { r: 220, g: 110, b: 40 });
    await page.goto('/admin/dashboard/media');
    await uploadFile(page, cover.file);
    await expect(page.getByText('cover-pick.jpg')).toBeVisible();
    await page
      .getByText('cover-pick.jpg')
      .locator('..')
      .getByRole('button', { name: 'Edit alt' })
      .click();
    await page.getByRole('dialog').getByRole('textbox').fill('Terracotta rooftops at dusk.');
    await page.getByRole('button', { name: 'Save alt text' }).click();
    await expect(toast(page, /alt/i)).toBeVisible();

    // Blog cover + inline, stay after save, reload persists.
    await page.goto('/admin/dashboard/blogs/new');
    await page.getByPlaceholder('Title').fill('Evening on the quay');
    await page.getByPlaceholder(/Tell readers/).fill('A short walk.');
    await page.getByText('Add a cover image').click();
    const picker = page.getByRole('dialog', { name: /Choose a cover image/i });
    await expect(picker).toBeVisible();
    const focusedInside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
    });
    expect(focusedInside, 'focus should move into the picker when it opens').toBe(true);
    await page.keyboard.press('Tab');
    const tabStayed = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
    });
    expect(tabStayed, 'Tab should cycle inside the picker').toBe(true);
    // Keyboard: Escape closes, then reopen and pick.
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await page.getByText('Add a cover image').click();
    await picker.getByText('cover-pick.jpg').click();
    await picker.getByRole('button', { name: 'Use this image' }).click();
    await expect(page.getByRole('img', { name: 'Terracotta rooftops at dusk.' })).toBeVisible();

    await page.getByRole('button', { name: 'Image', exact: true }).click();
    const inline = page.getByRole('dialog', { name: /Insert an image/i });
    await expect(inline).toBeVisible();
    await inline.getByText('cover-pick.jpg').click();
    // Require alt is already set; choose medium and insert.
    const medium = inline.getByRole('radio', { name: /Medium/ });
    if (await medium.count()) {
      await medium.check();
    }
    await inline.getByRole('button', { name: 'Use this image' }).click();

    await page.locator('.ql-editor').first().click();
    await page.keyboard.type(' The boats lean on the mud.');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/blogs\/new\?slug=/);
    await expect(page.getByText(/You are editing this document/i)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(
      page.getByRole('img', { name: 'Terracotta rooftops at dusk.' }).first(),
    ).toBeVisible();
    await expect(page.locator('.ql-editor img')).toHaveCount(1);
    await expect(page.locator('.ql-editor img')).toHaveAttribute(
      'alt',
      'Terracotta rooftops at dusk.',
    );

    const published = await adminGet<{ slug: string; imageUrl: string; imageAlt: string }>(
      page,
      'blogs/evening-on-the-quay',
    );
    expect(published.imageUrl).toContain('/media/');
    expect(published.imageAlt).toBe('Terracotta rooftops at dusk.');
    const key = await issueReadKey(page);
    const publicPost = await publicGet(page, `posts/${published.slug}`, key);
    expect(publicPost.status()).toBe(200);
    const body = (await publicPost.json()) as { data?: { imageUrl?: string }; imageUrl?: string };
    const imageUrl = body.data?.imageUrl ?? body.imageUrl;
    expect(imageUrl).toBe(published.imageUrl);
    const served = await page.request.get(imageUrl!);
    expect(served.status()).toBe(200);
    expect(served.headers()['content-type']).toMatch(/image\//);
    expect(served.headers()['x-content-type-options']).toBe('nosniff');

    // Event cover
    await page.goto('/admin/dashboard/events/new');
    await page.getByLabel('Event title').fill('Harbour festival');
    await page.getByRole('button', { name: 'Choose from library' }).click();
    const eventPicker = page.getByRole('dialog', { name: /cover|image/i });
    await eventPicker.getByText('cover-pick.jpg').click();
    await eventPicker.getByRole('button', { name: 'Use this image' }).click();
    await expect(page.getByRole('img', { name: /Terracotta|Event cover/i }).first()).toBeVisible();

    // Author avatar
    await page.goto('/admin/dashboard/authors/new');
    await page.getByRole('textbox', { name: /^Name/ }).fill('Jordan Quay');
    await page.getByRole('button', { name: 'Choose from library' }).click();
    const authorPicker = page.getByRole('dialog');
    await authorPicker.getByText('cover-pick.jpg').click();
    await authorPicker.getByRole('button', { name: 'Use this image' }).click();
    await expect(page.locator('img[src*="/media/"]').first()).toBeVisible();

    // Whitepaper cover
    await page.goto('/admin/dashboard/whitepapers/new');
    await page.getByRole('button', { name: 'Choose from library' }).click();
    const paperPicker = page.getByRole('dialog', { name: /cover/i });
    await paperPicker.getByText('cover-pick.jpg').click();
    await paperPicker.getByRole('button', { name: 'Use this image' }).click();
    await expect(page.getByRole('img', { name: 'Whitepaper cover' }).first()).toBeVisible();
    await page.getByRole('textbox', { name: /^Title$/ }).fill('Light on the water');
    await page.getByRole('textbox', { name: /^Description$/ }).fill('A study.');
    await page.locator('.ql-editor').first().click();
    await page.keyboard.type('Body of the paper.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/whitepapers\/new\?slug=/);
    await page.reload();
    await expect(page.getByRole('img', { name: 'Whitepaper cover' }).first()).toBeVisible();
  });

  test('live collaboration: two admins, presence, locks, takeover, stale save, comments, polling, isolation', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const aCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const bCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    // Wrap EventSource so the test can drop the live stream mid-session.
    await bCtx.addInitScript(() => {
      const Orig = window.EventSource;
      const w = window as unknown as Window & {
        __cogcmsEventSources: EventSource[];
        __cogcmsBlockSse: boolean;
      };
      const instances: EventSource[] = [];
      w.__cogcmsEventSources = instances;
      w.__cogcmsBlockSse = false;
      const Wrapped = function (this: EventSource, url: string | URL, opts?: EventSourceInit) {
        const source = new Orig(w.__cogcmsBlockSse ? 'http://127.0.0.1:9/blocked-sse' : url, opts);
        instances.push(source);
        return source;
      };
      Wrapped.prototype = Orig.prototype;
      (Wrapped as unknown as { CONNECTING: number }).CONNECTING = Orig.CONNECTING;
      (Wrapped as unknown as { OPEN: number }).OPEN = Orig.OPEN;
      (Wrapped as unknown as { CLOSED: number }).CLOSED = Orig.CLOSED;
      window.EventSource = Wrapped as unknown as typeof EventSource;
    });
    const a = await aCtx.newPage();
    const b = await bCtx.newPage();
    const bag = { errors: [] as string[], warnings: [] as string[] };
    attachConsole(a, bag);
    attachConsole(b, bag);

    await login(a, ADMIN.email, ADMIN.password);
    await selectSite(a);
    await login(b, ADMIN_B.email, ADMIN_B.password);
    await selectSite(b);

    const created = await adminRequest(a, 'blogs', 'POST', {
      title: 'Shared draft',
      slug: 'shared-draft',
      excerpt: 'Two editors.',
      content: '<p>Opening line.</p>',
      status: 'draft',
    });
    expect(created.status).toBe(201);

    await a.goto('/admin/dashboard/blogs/new?slug=shared-draft');
    await expect(a.getByPlaceholder('Title')).toHaveValue('Shared draft');
    await expect(a.getByText(/You are editing this document/i)).toBeVisible({ timeout: 15_000 });

    await b.goto('/admin/dashboard/blogs/new?slug=shared-draft');
    await expect(b.getByText(/is currently editing this document/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(b.getByRole('button', { name: 'Take over editing' })).toBeVisible();
    await expect(b.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    // Presence avatars on both sides.
    await expect(a.getByLabel('People currently on this document')).toBeVisible();
    await expect(b.getByLabel('People currently on this document')).toBeVisible();

    // Heartbeat: the lease should be extended after the 15s interval.
    const createdBody = created.body as { _id?: string | { toString(): string }; id?: string };
    const resourceId = String(createdBody._id ?? createdBody.id);
    const before = await adminGet<{ lock: { expiresAt: string } | null }>(
      a,
      'collaboration?resourceType=blog&resourceId=' + resourceId,
    );
    expect(before.lock).toBeTruthy();
    await a.waitForTimeout(16_000);
    const after = await adminGet<{ lock: { expiresAt: string } | null }>(
      a,
      'collaboration?resourceType=blog&resourceId=' + resourceId,
    );
    expect(Date.parse(after.lock!.expiresAt)).toBeGreaterThan(Date.parse(before.lock!.expiresAt));

    // Comments: A posts, B sees it live, B resolves, A deletes.
    await a.getByRole('button', { name: 'Comments' }).click();
    const aComments = a.getByRole('dialog', { name: 'Comments' });
    await expect(aComments).toBeVisible();
    await aComments.getByPlaceholder(/Leave a comment/i).fill('Shall we open with the quay?');
    await aComments.getByRole('button', { name: 'Post comment' }).click();
    await expect(aComments.getByText('Shall we open with the quay?')).toBeVisible();

    await b.getByRole('button', { name: 'Comments' }).click();
    const bComments = b.getByRole('dialog', { name: 'Comments' });
    await expect(bComments.getByText('Shall we open with the quay?')).toBeVisible({
      timeout: 10_000,
    });
    await bComments.getByRole('button', { name: 'Resolve' }).click();
    await expect(aComments.getByText('Shall we open with the quay?')).toHaveCount(0, {
      timeout: 10_000,
    });
    await aComments.getByRole('checkbox', { name: /Show resolved/i }).check();
    await expect(aComments.getByText('Shall we open with the quay?')).toBeVisible();
    await expect(aComments.getByText(/· Resolved/)).toBeVisible();
    await aComments.getByRole('button', { name: 'Delete' }).click();
    await expect(aComments.getByText('Shall we open with the quay?')).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(bComments.getByText('Shall we open with the quay?')).toHaveCount(0, {
      timeout: 10_000,
    });
    await aComments.getByRole('button', { name: 'Close comments' }).click();
    await bComments.getByRole('button', { name: 'Close comments' }).click();

    // Takeover with confirmation.
    await b.getByRole('button', { name: 'Take over editing' }).click();
    const confirm = b.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Take over' }).click();
    await expect(b.getByText(/You are editing this document/i)).toBeVisible({ timeout: 10_000 });
    await expect(a.getByText(/is currently editing this document/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(a.getByRole('button', { name: 'Save draft' })).toBeDisabled();

    // Stale save: B holds the lock. Update the document out of band, then have B save
    // with the stale token the form loaded with.
    await b.route('**/api/admin/blogs/shared-draft', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      const payload = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
      payload.expectedUpdatedAt = '2020-01-01T00:00:00.000Z';
      await route.continue({ postData: JSON.stringify(payload) });
    });
    await b.getByPlaceholder('Title').fill('Shared draft, edited by B');
    await b.getByRole('button', { name: 'Save draft' }).click();
    await expect(
      toast(b, /changed while you were|reload before saving|currently editing/i),
    ).toBeVisible();
    await b.unroute('**/api/admin/blogs/shared-draft');

    // SSE fallback to polling: drop the live connection and fire two errors,
    // which is the hook's threshold for switching to HTTP polling.
    await b.evaluate(() => {
      const w = window as unknown as Window & {
        __cogcmsBlockSse?: boolean;
        __cogcmsEventSources?: EventSource[];
      };
      w.__cogcmsBlockSse = true;
      for (const source of w.__cogcmsEventSources ?? []) {
        source.close();
        source.dispatchEvent(new Event('error'));
        source.dispatchEvent(new Event('error'));
      }
    });
    await expect(b.getByText('Polling')).toBeVisible({ timeout: 10_000 });

    // Release on close: navigating away unmounts the editor and must free the lock
    // so A can save. (Closing the Playwright context is too abrupt for keepalive.)
    await b.goto('about:blank');
    await expect(a.getByRole('button', { name: 'Save draft' })).toBeEnabled({ timeout: 15_000 });
    await expect(a.getByRole('button', { name: 'Take over editing' })).toHaveCount(0);
    await bCtx.close();

    // Site isolation: a document on site B must not show site A comments or locks.
    await selectSite(a, SITE_B.name);
    const other = await adminRequest(a, 'blogs', 'POST', {
      title: 'Beta only',
      slug: 'beta-only',
      content: '<p>Site B.</p>',
      status: 'draft',
    });
    expect(other.status).toBe(201);
    const otherBody = other.body as { _id?: string; id?: string };
    const otherId = String(otherBody._id ?? otherBody.id);
    // Switch back to A and ask for B's resource — snapshot must be empty.
    await selectSite(a);
    const isolated = await adminGet<{
      lock: unknown;
      comments: unknown[];
      presence: unknown[];
    }>(a, `collaboration?resourceType=blog&resourceId=${otherId}`);
    expect(isolated.lock).toBeNull();
    expect(isolated.comments).toEqual([]);

    await aCtx.close();
    const serious = notable(bag.errors);
    expect(serious, serious.join('\n')).toEqual([]);
  });

  test('no outstanding console errors from earlier tests', () => {
    const serious = notable(consoleBag.errors);
    const hydration = notable(consoleBag.errors.concat(consoleBag.warnings)).filter((text) =>
      /hydration|did not match/i.test(text),
    );
    expect(serious, serious.join('\n')).toEqual([]);
    expect(hydration, hydration.join('\n')).toEqual([]);
  });
});
