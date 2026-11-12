import { describe, expect, it } from 'vitest';
import { POST as createBlog } from '@/app/api/admin/blogs/route';
import { PUT as updateBlog } from '@/app/api/admin/blogs/[slug]/route';
import { GET as getSnapshot } from '@/app/api/admin/collaboration/route';
import { GET as streamCollaboration } from '@/app/api/admin/collaboration/stream/route';
import { POST as heartbeat } from '@/app/api/admin/collaboration/heartbeat/route';
import { POST as lockAction } from '@/app/api/admin/collaboration/locks/route';
import {
  GET as listComments,
  POST as createComment,
} from '@/app/api/admin/collaboration/comments/route';
import {
  PATCH as patchComment,
  DELETE as deleteComment,
} from '@/app/api/admin/collaboration/comments/[id]/route';
import ContentLock from '@/models/ContentLock';
import { LOCK_TTL_MS } from '@/lib/collaboration/types';
import { authenticatedRequest, createTestSite, createTestUser } from '@/tests/setup/factories';
import { NextRequest } from 'next/server';
import type { IUser } from '@/models/User';

const root = { params: Promise.resolve({}) };
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

async function seedBlog(admin: IUser, siteId: string, slug = 'collab-post') {
  const created = await createBlog(
    await authenticatedRequest('http://localhost:3003/api/admin/blogs', {
      user: admin,
      siteId,
      method: 'POST',
      json: { title: 'Collaboration draft', slug, content: '<p>Hello world</p>', status: 'draft' },
    }),
    root,
  );
  expect(created.status).toBe(201);
  return created.json();
}

function resourceUrl(
  path: string,
  resourceType: string,
  resourceId: string,
): string {
  const url = new URL(`http://localhost:3003/api/admin/collaboration${path}`);
  url.searchParams.set('resourceType', resourceType);
  url.searchParams.set('resourceId', resourceId);
  return `${url.pathname}${url.search}`;
}

async function call(
  user: IUser,
  path: string,
  options: { method?: string; siteId?: string; json?: unknown; headers?: Record<string, string> } = {},
) {
  return authenticatedRequest(`http://localhost:3003${path}`, { user, ...options });
}

describe('admin live collaboration', () => {
  it('acquires a lease, rejects a concurrent editor, expires, and supports takeover', async () => {
    const alice = await createTestUser({ email: 'alice-lock@example.com' });
    const bob = await createTestUser({ email: 'bob-lock@example.com' });
    const site = await createTestSite();
    const siteId = site._id.toString();
    const blog = await seedBlog(alice, siteId, 'lock-story');
    const resource = { resourceType: 'blog', resourceId: blog._id };

    const acquired = await lockAction(
      await call(alice, '/api/admin/collaboration/locks', {
        siteId,
        method: 'POST',
        json: { ...resource, action: 'acquire' },
      }),
      root,
    );
    expect(acquired.status).toBe(200);
    const aliceLock = await acquired.json();
    expect(aliceLock.acquired).toBe(true);
    expect(aliceLock.lock.userId).toBe(alice._id.toString());
    expect(aliceLock.lock.userName).toBe(alice.name);
    const leaseMs = Date.parse(aliceLock.lock.expiresAt) - Date.parse(aliceLock.lock.acquiredAt);
    expect(leaseMs).toBe(LOCK_TTL_MS);

    const blocked = await lockAction(
      await call(bob, '/api/admin/collaboration/locks', {
        siteId,
        method: 'POST',
        json: { ...resource, action: 'acquire' },
      }),
      root,
    );
    expect(blocked.status).toBe(409);
    const blockedBody = await blocked.json();
    expect(blockedBody.code).toBe('CONFLICT');
    expect(blockedBody.details.lock.userId).toBe(alice._id.toString());

    const bobSave = await updateBlog(
      await call(bob, '/api/admin/blogs/lock-story', {
        siteId,
        method: 'PUT',
        json: { title: 'Bob should not win' },
      }),
      slugCtx('lock-story'),
    );
    expect(bobSave.status).toBe(409);
    expect((await bobSave.json()).code).toBe('CONFLICT');

    const aliceSave = await updateBlog(
      await call(alice, '/api/admin/blogs/lock-story', {
        siteId,
        method: 'PUT',
        json: { title: 'Alice holds the pen' },
      }),
      slugCtx('lock-story'),
    );
    expect(aliceSave.status).toBe(200);

    const beat = await heartbeat(
      await call(alice, '/api/admin/collaboration/heartbeat', {
        siteId,
        method: 'POST',
        json: resource,
      }),
      root,
    );
    expect(beat.status).toBe(200);
    const beatBody = await beat.json();
    expect(beatBody.lock.userId).toBe(alice._id.toString());
    expect(Date.parse(beatBody.lock.expiresAt)).toBeGreaterThan(Date.parse(aliceLock.lock.expiresAt) - 1);
    expect(beatBody.presence.some((row: { userId: string }) => row.userId === alice._id.toString())).toBe(
      true,
    );

    const bobBeat = await heartbeat(
      await call(bob, '/api/admin/collaboration/heartbeat', {
        siteId,
        method: 'POST',
        json: resource,
      }),
      root,
    );
    expect(bobBeat.status).toBe(200);
    expect((await bobBeat.json()).lock.userId).toBe(alice._id.toString());

    await ContentLock.updateOne(
      { siteId, resourceType: 'blog', resourceId: blog._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const afterExpiry = await lockAction(
      await call(bob, '/api/admin/collaboration/locks', {
        siteId,
        method: 'POST',
        json: { ...resource, action: 'acquire' },
      }),
      root,
    );
    expect(afterExpiry.status).toBe(200);
    expect((await afterExpiry.json()).lock.userId).toBe(bob._id.toString());

    const released = await lockAction(
      await call(bob, '/api/admin/collaboration/locks', {
        siteId,
        method: 'POST',
        json: { ...resource, action: 'release' },
      }),
      root,
    );
    expect(released.status).toBe(200);
    expect((await released.json()).lock).toBeNull();

    const aliceAgain = await lockAction(
      await call(alice, '/api/admin/collaboration/locks', {
        siteId,
        method: 'POST',
        json: { ...resource, action: 'acquire' },
      }),
      root,
    );
    expect(aliceAgain.status).toBe(200);

    const takeover = await lockAction(
      await call(bob, '/api/admin/collaboration/locks', {
        siteId,
        method: 'POST',
        json: { ...resource, action: 'takeover' },
      }),
      root,
    );
    expect(takeover.status).toBe(200);
    expect((await takeover.json()).lock.userId).toBe(bob._id.toString());

    const aliceLost = await heartbeat(
      await call(alice, '/api/admin/collaboration/heartbeat', {
        siteId,
        method: 'POST',
        json: resource,
      }),
      root,
    );
    expect(aliceLost.status).toBe(200);
    expect((await aliceLost.json()).lock.userId).toBe(bob._id.toString());
  });

  it('scopes comments by site, supports resolve and delete, and rejects CSRF or anonymous writes', async () => {
    const admin = await createTestUser();
    const siteA = await createTestSite();
    const siteB = await createTestSite();
    const editorOnA = await createTestUser({
      role: 'editor',
      siteIds: [siteA._id.toString()],
    });
    const blogA = await seedBlog(admin, siteA._id.toString(), 'comments-a');
    const resourceA = { resourceType: 'blog' as const, resourceId: blogA._id };

    const created = await createComment(
      await call(editorOnA, '/api/admin/collaboration/comments', {
        siteId: siteA._id.toString(),
        method: 'POST',
        json: { ...resourceA, body: '  Tighten the lede.  ', field: 'title' },
      }),
      root,
    );
    expect(created.status).toBe(201);
    const comment = await created.json();
    expect(comment.body).toBe('Tighten the lede.');
    expect(comment.field).toBe('title');
    expect(comment.userId).toBe(editorOnA._id.toString());
    expect(comment.resolvedAt).toBeNull();

    const empty = await createComment(
      await call(editorOnA, '/api/admin/collaboration/comments', {
        siteId: siteA._id.toString(),
        method: 'POST',
        json: { ...resourceA, body: '   ' },
      }),
      root,
    );
    expect(empty.status).toBe(400);

    const otherSite = await createComment(
      await call(admin, '/api/admin/collaboration/comments', {
        siteId: siteB._id.toString(),
        method: 'POST',
        json: { ...resourceA, body: 'Should not land on A via B' },
      }),
      root,
    );
    expect(otherSite.status).toBe(201);
    const misplaced = await otherSite.json();
    // The comment is stored under site B (siteId-scoped) even with A's resourceId —
    // listing from A must not return it, listing from B with A's id would, so we
    // list A and B with the matching resource to confirm isolation.
    const listA = await (
      await listComments(
        await call(admin, resourceUrl('/comments', 'blog', blogA._id), {
          siteId: siteA._id.toString(),
        }),
        root,
      )
    ).json();
    expect(listA.data).toHaveLength(1);
    expect(listA.data[0].id).toBe(comment.id);

    const listBforA = await (
      await listComments(
        await call(admin, resourceUrl('/comments', 'blog', blogA._id), {
          siteId: siteB._id.toString(),
        }),
        root,
      )
    ).json();
    expect(listBforA.data.map((row: { id: string }) => row.id)).toContain(misplaced.id);
    expect(listBforA.data.map((row: { id: string }) => row.id)).not.toContain(comment.id);

    const resolved = await patchComment(
      await call(admin, `/api/admin/collaboration/comments/${comment.id}`, {
        siteId: siteA._id.toString(),
        method: 'PATCH',
        json: { resolved: true },
      }),
      idCtx(comment.id),
    );
    expect(resolved.status).toBe(200);
    const resolvedBody = await resolved.json();
    expect(resolvedBody.resolvedAt).toBeTruthy();
    expect(resolvedBody.resolvedBy).toBe(admin._id.toString());

    const editorEditsAdmin = await patchComment(
      await call(editorOnA, `/api/admin/collaboration/comments/${comment.id}`, {
        siteId: siteA._id.toString(),
        method: 'PATCH',
        json: { body: 'Hijacked' },
      }),
      idCtx(comment.id),
    );
    // editor is the author, so body edit is allowed
    expect(editorEditsAdmin.status).toBe(200);

    const adminComment = await (
      await createComment(
        await call(admin, '/api/admin/collaboration/comments', {
          siteId: siteA._id.toString(),
          method: 'POST',
          json: { ...resourceA, body: 'Admin note' },
        }),
        root,
      )
    ).json();

    const editorDeletesAdmin = await deleteComment(
      await call(editorOnA, `/api/admin/collaboration/comments/${adminComment.id}`, {
        siteId: siteA._id.toString(),
        method: 'DELETE',
      }),
      idCtx(adminComment.id),
    );
    expect(editorDeletesAdmin.status).toBe(403);

    const adminDeletes = await deleteComment(
      await call(admin, `/api/admin/collaboration/comments/${adminComment.id}`, {
        siteId: siteA._id.toString(),
        method: 'DELETE',
      }),
      idCtx(adminComment.id),
    );
    expect(adminDeletes.status).toBe(200);

    const crossOrigin = await createComment(
      await call(admin, '/api/admin/collaboration/comments', {
        siteId: siteA._id.toString(),
        method: 'POST',
        json: { ...resourceA, body: 'Evil' },
        headers: { origin: 'https://evil.example' },
      }),
      root,
    );
    expect(crossOrigin.status).toBe(403);

    const anonymous = await createComment(
      new NextRequest('http://localhost:3003/api/admin/collaboration/comments', {
        method: 'POST',
        headers: { origin: 'http://localhost:3003', 'content-type': 'application/json' },
        body: JSON.stringify({ ...resourceA, body: 'Anon' }),
      }),
      root,
    );
    expect(anonymous.status).toBe(401);

  });

  it('rejects a stale save, accepts a matching token, and streams a snapshot over SSE', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const site = await createTestSite();
    const siteId = site._id.toString();
    const blog = await seedBlog(alice, siteId, 'stale-story');

    const first = await updateBlog(
      await call(alice, '/api/admin/blogs/stale-story', {
        siteId,
        method: 'PUT',
        json: { title: 'First write' },
      }),
      slugCtx('stale-story'),
    );
    expect(first.status).toBe(200);
    const afterFirst = await first.json();
    const token = afterFirst.updatedAt;
    expect(typeof token).toBe('string');

    const stale = await updateBlog(
      await call(alice, '/api/admin/blogs/stale-story', {
        siteId,
        method: 'PUT',
        json: { title: 'Should fail', expectedUpdatedAt: '2020-01-01T00:00:00.000Z' },
      }),
      slugCtx('stale-story'),
    );
    expect(stale.status).toBe(409);
    const staleBody = await stale.json();
    expect(staleBody.code).toBe('CONFLICT');
    expect(staleBody.details.updatedAt).toBe(token);

    const fresh = await updateBlog(
      await call(alice, '/api/admin/blogs/stale-story', {
        siteId,
        method: 'PUT',
        json: { title: 'Second write', expectedUpdatedAt: token },
      }),
      slugCtx('stale-story'),
    );
    expect(fresh.status).toBe(200);
    expect((await fresh.json()).title).toBe('Second write');

    const snapshot = await getSnapshot(
      await call(bob, resourceUrl('', 'blog', blog._id), { siteId }),
      root,
    );
    expect(snapshot.status).toBe(200);
    const snapBody = await snapshot.json();
    expect(snapBody).toEqual(
      expect.objectContaining({
        lock: null,
        presence: expect.any(Array),
        comments: expect.any(Array),
      }),
    );

    const abort = new AbortController();
    const sessionReq = await call(alice, resourceUrl('/stream', 'blog', blog._id), { siteId });
    const streamed = await streamCollaboration(
      new NextRequest(sessionReq.url, {
        method: 'GET',
        headers: sessionReq.headers,
        signal: abort.signal,
      }),
    );
    expect(streamed.status).toBe(200);
    expect(streamed.headers.get('content-type')).toContain('text/event-stream');
    const reader = streamed.body!.getReader();
    const decoder = new TextDecoder();
    let acc = '';
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !acc.includes('event: snapshot')) {
      const { value, done } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
    }
    expect(acc).toContain('event: snapshot');
    expect(acc).toContain(alice._id.toString());
    abort.abort();
    try {
      await reader.cancel();
    } catch {
      /* already closing */
    }
  });

  it('rejects a malformed resource and hides another site’s lock snapshot', async () => {
    const admin = await createTestUser();
    const [siteA, siteB] = await Promise.all([createTestSite(), createTestSite()]);
    const blog = await seedBlog(admin, siteA._id.toString(), 'tenant-lock');
    const resource = { resourceType: 'blog', resourceId: blog._id, action: 'acquire' };

    const locked = await lockAction(
      await call(admin, '/api/admin/collaboration/locks', {
        siteId: siteA._id.toString(),
        method: 'POST',
        json: resource,
      }),
      root,
    );
    expect(locked.status).toBe(200);

    const otherSite = await getSnapshot(
      await call(admin, resourceUrl('', 'blog', blog._id), { siteId: siteB._id.toString() }),
      root,
    );
    expect(otherSite.status).toBe(200);
    expect((await otherSite.json()).lock).toBeNull();

    const invalid = await getSnapshot(
      await call(admin, '/api/admin/collaboration?resourceType=blog&resourceId=nope', {
        siteId: siteA._id.toString(),
      }),
      root,
    );
    expect(invalid.status).toBe(400);
  });
});
