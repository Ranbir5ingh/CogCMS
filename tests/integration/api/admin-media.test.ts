import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { GET as listMedia, POST as uploadMedia } from '@/app/api/admin/media/route';
import {
  DELETE as deleteMedia,
  GET as getMedia,
  PATCH as patchMedia,
} from '@/app/api/admin/media/[id]/route';
import { GET as serveMedia } from '@/app/media/[...key]/route';
import { SESSION_COOKIE, signSession } from '@/lib/auth/session';
import Blog from '@/models/Blog';
import { createTestSite, createTestUser } from '@/tests/setup/factories';
import type { IUser } from '@/models/User';

const rootContext = { params: Promise.resolve({}) };
const idContext = (id: string) => ({ params: Promise.resolve({ id }) });

async function jpeg(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 80, b: 160 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function multipartRequest(
  user: IUser,
  siteId: string,
  options: {
    bytes?: Buffer;
    filename?: string;
    type?: string;
    alt?: string;
    headers?: Record<string, string>;
    omitFile?: boolean;
  } = {},
): Promise<NextRequest> {
  const form = new FormData();
  if (!options.omitFile) {
    const bytes = options.bytes ?? (await jpeg());
    form.append(
      'file',
      new File([new Uint8Array(bytes)], options.filename ?? 'cover.jpg', {
        type: options.type ?? 'image/jpeg',
      }),
    );
  }
  if (options.alt !== undefined) form.append('alt', options.alt);
  const siteIds = user.siteIds.map(String);
  const token = await signSession({ sub: user._id.toString(), role: user.role, siteIds }, false);
  const headers = new Headers();
  headers.set('cookie', `${SESSION_COOKIE}=${token}`);
  headers.set('x-cms-site', siteId);
  headers.set('origin', 'http://localhost:3003');
  for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value);
  return new NextRequest('http://localhost:3003/api/admin/media', {
    method: 'POST',
    headers,
    body: form,
  });
}

async function authed(
  user: IUser,
  url: string,
  options: {
    method?: string;
    siteId?: string;
    json?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<NextRequest> {
  const method = options.method ?? 'GET';
  const siteIds = user.siteIds.map(String);
  const token = await signSession({ sub: user._id.toString(), role: user.role, siteIds }, false);
  const headers = new Headers();
  headers.set('cookie', `${SESSION_COOKIE}=${token}`);
  if (options.siteId) headers.set('x-cms-site', options.siteId);
  if (method !== 'GET') {
    headers.set('origin', 'http://localhost:3003');
    headers.set('content-type', 'application/json');
  }
  for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value);
  return new NextRequest(url, {
    method,
    headers,
    body: options.json === undefined ? undefined : JSON.stringify(options.json),
  });
}

describe('admin media library', () => {
  let mediaRoot: string;

  beforeEach(async () => {
    mediaRoot = await mkdtemp(path.join(os.tmpdir(), 'cms-media-int-'));
    vi.stubEnv('MEDIA_ROOT', mediaRoot);
    vi.stubEnv('NEXT_PUBLIC_CMS_URL', 'http://localhost:3003');
    vi.stubEnv('S3_REGION', '');
    vi.stubEnv('S3_BUCKET_NAME', '');
    vi.stubEnv('S3_PUBLIC_URL', '');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(mediaRoot, { recursive: true, force: true });
  });

  it('uploads a validated image, stores sizes, and serves the public bytes', async () => {
    const admin = await createTestUser();
    const site = await createTestSite();
    const bytes = await jpeg(1600, 900);
    const request = await multipartRequest(admin, site._id.toString(), {
      bytes,
      alt: 'Harbour at dusk',
      filename: 'harbour.jpg',
    });
    const createdResponse = await uploadMedia(request, rootContext);
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    expect(created.alt).toBe('Harbour at dusk');
    expect(created.originalName).toBe('harbour.jpg');
    expect(created.width).toBe(1600);
    expect(created.height).toBe(900);
    expect(created.mimeType).toBe('image/jpeg');
    expect(created.sizes.original.url).toMatch(/^http:\/\/localhost:3003\/media\/sites\//);
    expect(created.sizes.thumbnail.key).toContain('-thumbnail.webp');
    expect(created.sizes.medium.key).toContain('-medium.webp');
    expect(created.sizes.large.key).toContain('-large.webp');
    expect(created.siteId).toBeUndefined();

    const keyParts = new URL(created.sizes.original.url).pathname
      .replace(/^\/media\//, '')
      .split('/');
    const served = await serveMedia(
      new NextRequest('http://localhost:3003/media/' + keyParts.join('/')),
      {
        params: Promise.resolve({ key: keyParts }),
      },
    );
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/jpeg');
    const servedBytes = Buffer.from(await served.arrayBuffer());
    expect(servedBytes.equals(bytes)).toBe(true);

    const listed = await listMedia(
      await authed(admin, 'http://localhost:3003/api/admin/media', {
        siteId: site._id.toString(),
      }),
      rootContext,
    );
    const body = await listed.json();
    expect(body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(created.id);
    expect(body.data[0].alt).toBe('Harbour at dusk');
  });

  it('isolates assets by site and rejects unauthenticated or cross-origin uploads', async () => {
    const admin = await createTestUser();
    const [siteA, siteB] = await Promise.all([createTestSite(), createTestSite()]);
    const uploaded = await uploadMedia(
      await multipartRequest(admin, siteA._id.toString(), { alt: 'Site A only' }),
      rootContext,
    );
    expect(uploaded.status).toBe(201);
    const asset = await uploaded.json();

    const listB = await (
      await listMedia(
        await authed(admin, 'http://localhost:3003/api/admin/media', {
          siteId: siteB._id.toString(),
        }),
        rootContext,
      )
    ).json();
    expect(listB.meta.total).toBe(0);
    expect(listB.data).toEqual([]);

    const cross = await getMedia(
      await authed(admin, `http://localhost:3003/api/admin/media/${asset.id}`, {
        siteId: siteB._id.toString(),
      }),
      idContext(asset.id),
    );
    expect(cross.status).toBe(404);

    const editor = await createTestUser({
      role: 'editor',
      siteIds: [siteB._id.toString()],
    });
    const forbidden = await uploadMedia(
      await multipartRequest(editor, siteA._id.toString()),
      rootContext,
    );
    expect(forbidden.status).toBe(403);

    const unauthenticated = new NextRequest('http://localhost:3003/api/admin/media', {
      method: 'POST',
      headers: { origin: 'http://localhost:3003' },
      body: new FormData(),
    });
    expect((await uploadMedia(unauthenticated, rootContext)).status).toBe(401);

    const crossOrigin = await uploadMedia(
      await multipartRequest(admin, siteA._id.toString(), {
        headers: { origin: 'https://evil.example' },
      }),
      rootContext,
    );
    expect(crossOrigin.status).toBe(403);
  });

  it('searches literally, paginates, updates alt text, and refuses a referenced delete', async () => {
    const admin = await createTestUser();
    const site = await createTestSite();
    const siteId = site._id.toString();
    const names = ['alpha-cover.jpg', 'a+b special.jpg', 'zeta.jpg'];
    const alts = ['River bank', 'a+b literal', 'Unused'];
    const created = [];
    for (let i = 0; i < names.length; i++) {
      const response = await uploadMedia(
        await multipartRequest(admin, siteId, {
          filename: names[i],
          alt: alts[i],
          bytes: await jpeg(400, 300),
        }),
        rootContext,
      );
      expect(response.status).toBe(201);
      created.push(await response.json());
    }

    const plus = await (
      await listMedia(
        await authed(
          admin,
          'http://localhost:3003/api/admin/media?search=' + encodeURIComponent('a+b'),
          {
            siteId,
          },
        ),
        rootContext,
      )
    ).json();
    expect(plus.meta.total).toBe(1);
    expect(plus.data[0].originalName).toBe('a+b special.jpg');

    const page = await (
      await listMedia(
        await authed(admin, 'http://localhost:3003/api/admin/media?page=2&limit=2', { siteId }),
        rootContext,
      )
    ).json();
    expect(page.meta).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(page.data).toHaveLength(1);

    const invalid = await listMedia(
      await authed(admin, 'http://localhost:3003/api/admin/media?limit=101', { siteId }),
      rootContext,
    );
    expect(invalid.status).toBe(400);

    const patched = await patchMedia(
      await authed(admin, `http://localhost:3003/api/admin/media/${created[0].id}`, {
        siteId,
        method: 'PATCH',
        json: { alt: 'River bank at dawn' },
      }),
      idContext(created[0].id),
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).alt).toBe('River bank at dawn');

    await Blog.create({
      siteId: site._id,
      title: 'Uses cover',
      slug: 'uses-cover',
      content: '<p>Hello</p>',
      imageUrl: created[0].sizes.large.url,
      imageAlt: 'River bank at dawn',
      rendered: {
        html: '<p>Hello</p>',
        toc: [],
        wordCount: 1,
        readingTime: 1,
        pipelineVersion: 1,
        renderedAt: new Date(),
      },
      status: 'publish',
    });

    const blocked = await deleteMedia(
      await authed(admin, `http://localhost:3003/api/admin/media/${created[0].id}`, {
        siteId,
        method: 'DELETE',
      }),
      idContext(created[0].id),
    );
    expect(blocked.status).toBe(409);
    const blockedBody = await blocked.json();
    expect(blockedBody.code).toBe('CONFLICT');
    expect(blockedBody.details.references[0].type).toBe('blog');

    const stillThere = await getMedia(
      await authed(admin, `http://localhost:3003/api/admin/media/${created[0].id}`, { siteId }),
      idContext(created[0].id),
    );
    expect(stillThere.status).toBe(200);

    const removed = await deleteMedia(
      await authed(admin, `http://localhost:3003/api/admin/media/${created[2].id}`, {
        siteId,
        method: 'DELETE',
      }),
      idContext(created[2].id),
    );
    expect(removed.status).toBe(200);
    expect(
      (
        await getMedia(
          await authed(admin, `http://localhost:3003/api/admin/media/${created[2].id}`, { siteId }),
          idContext(created[2].id),
        )
      ).status,
    ).toBe(404);
  });

  it('rejects a MIME mismatch, an empty upload, and an unsafe public key', async () => {
    const admin = await createTestUser();
    const site = await createTestSite();
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: 'green' },
    })
      .png()
      .toBuffer();
    const mismatch = await uploadMedia(
      await multipartRequest(admin, site._id.toString(), {
        bytes: png,
        type: 'image/jpeg',
        filename: 'lying.jpg',
      }),
      rootContext,
    );
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toMatch(/does not match/);

    const empty = await uploadMedia(
      await multipartRequest(admin, site._id.toString(), { omitFile: true }),
      rootContext,
    );
    expect(empty.status).toBe(400);

    const unsafe = await serveMedia(
      new NextRequest('http://localhost:3003/media/../package.json'),
      {
        params: Promise.resolve({ key: ['..', 'package.json'] }),
      },
    );
    expect(unsafe.status).toBe(404);

    const staging = await serveMedia(
      new NextRequest('http://localhost:3003/media/staging/abc/def'),
      { params: Promise.resolve({ key: ['staging', 'abc', 'def'] }) },
    );
    expect(staging.status).toBe(404);
  });
});
