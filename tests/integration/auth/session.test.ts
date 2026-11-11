import { describe, expect, it } from 'vitest';
import { GET as getSession, PUT as changePassword } from '@/app/api/admin/session/route';
import { verifyPassword } from '@/lib/auth/password';
import User from '@/models/User';
import { authenticatedRequest, createTestSite, createTestUser } from '@/tests/setup/factories';

const rootContext = { params: Promise.resolve({}) };
const sessionUrl = 'http://localhost:3003/api/admin/session';

async function storedHash(userId: string): Promise<string> {
  const user = await User.findById(userId).select('+passwordHash').exec();
  return user!.passwordHash;
}

describe('admin session', () => {
  it('returns the serialized user and only the sites an editor can access', async () => {
    const [siteA, siteB] = await Promise.all([createTestSite(), createTestSite()]);
    const editor = await createTestUser({ role: 'editor', siteIds: [siteA._id.toString()] });
    const response = await getSession(
      await authenticatedRequest(sessionUrl, { user: editor }),
      rootContext,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toMatchObject({
      id: editor._id.toString(),
      email: editor.email,
      role: 'editor',
      siteIds: [siteA._id.toString()],
    });
    expect(body.user).not.toHaveProperty('passwordHash');
    const siteIds = body.sites.map((site: { id: string }) => site.id);
    expect(siteIds).toContain(siteA._id.toString());
    expect(siteIds).not.toContain(siteB._id.toString());
  });

  it('rejects a session whose user has been deleted', async () => {
    const user = await createTestUser();
    const request = await authenticatedRequest(sessionUrl, { user });
    await User.deleteOne({ _id: user._id });
    expect((await getSession(request, rootContext)).status).toBe(401);
  });

  it('changes the password only with the correct current password', async () => {
    const user = await createTestUser({ password: 'correct-horse-battery' });
    const originalHash = await storedHash(user._id.toString());
    const put = (json: unknown, headers?: Record<string, string>) =>
      authenticatedRequest(sessionUrl, { user, method: 'PUT', json, headers });

    const wrong = await changePassword(
      await put({ currentPassword: 'wrong-password-123', newPassword: 'new-horse-battery' }),
      rootContext,
    );
    expect(wrong.status).toBe(400);
    expect(await storedHash(user._id.toString())).toBe(originalHash);

    for (const json of [
      { currentPassword: 'correct-horse-battery', newPassword: 'short' },
      { currentPassword: 'correct-horse-battery', newPassword: 'correct-horse-battery' },
      { currentPassword: 'correct-horse-battery', newPassword: 'new-horse-battery', extra: 1 },
    ]) {
      expect((await changePassword(await put(json), rootContext)).status).toBe(400);
    }

    const crossOrigin = await changePassword(
      await put(
        { currentPassword: 'correct-horse-battery', newPassword: 'new-horse-battery' },
        { origin: 'https://evil.example' },
      ),
      rootContext,
    );
    expect(crossOrigin.status).toBe(403);
    expect(await storedHash(user._id.toString())).toBe(originalHash);

    const changed = await changePassword(
      await put({ currentPassword: 'correct-horse-battery', newPassword: 'new-horse-battery' }),
      rootContext,
    );
    expect(changed.status).toBe(200);
    expect(await changed.json()).toEqual({ success: true });
    const newHash = await storedHash(user._id.toString());
    expect(await verifyPassword('new-horse-battery', newHash)).toBe(true);
    expect(await verifyPassword('correct-horse-battery', newHash)).toBe(false);
  });
});
