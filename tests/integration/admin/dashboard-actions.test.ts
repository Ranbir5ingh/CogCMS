import { beforeEach, describe, expect, it, vi } from 'vitest';

const context = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: async () => ({ set: context.cookieSet }) }));
vi.mock('next/cache', () => ({ revalidatePath: context.revalidatePath }));
vi.mock('@/lib/auth/require', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require')>()),
  requireUser: context.requireUser,
}));

import { setCurrentSiteAction } from '@/app/admin/dashboard/actions';
import { createTestSite } from '@/tests/setup/factories';

function asUser(role: 'admin' | 'editor', siteIds: string[] = []) {
  context.requireUser.mockResolvedValue({ id: 'user-1', role, siteIds, email: 'u@example.com' });
}

describe('setCurrentSiteAction', () => {
  beforeEach(() => {
    for (const mock of Object.values(context)) mock.mockReset();
  });

  it('sets the site cookie and refreshes the dashboard for an accessible active site', async () => {
    const site = await createTestSite();
    asUser('editor', [site._id.toString()]);
    expect(await setCurrentSiteAction(site._id.toString())).toEqual({ success: true });
    expect(context.cookieSet).toHaveBeenCalledWith(
      'cms_site',
      site._id.toString(),
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(context.revalidatePath).toHaveBeenCalledWith('/admin/dashboard', 'layout');
  });

  it('rejects a malformed id before touching auth or cookies', async () => {
    expect(await setCurrentSiteAction('not-an-id')).toEqual({
      success: false,
      error: 'Invalid site selection.',
    });
    expect(context.requireUser).not.toHaveBeenCalled();
    expect(context.cookieSet).not.toHaveBeenCalled();
  });

  it('refuses a site the editor is not assigned to', async () => {
    const [mine, other] = await Promise.all([createTestSite(), createTestSite()]);
    asUser('editor', [mine._id.toString()]);
    expect(await setCurrentSiteAction(other._id.toString())).toEqual({
      success: false,
      error: 'You do not have access to that site.',
    });
    expect(context.cookieSet).not.toHaveBeenCalled();
  });

  it('refuses an archived site even for an admin', async () => {
    const site = await createTestSite({ status: 'archived' });
    asUser('admin');
    expect(await setCurrentSiteAction(site._id.toString())).toEqual({
      success: false,
      error: 'That site is not active.',
    });
    expect(context.cookieSet).not.toHaveBeenCalled();
  });

  it('fails closed when the session is invalid', async () => {
    const site = await createTestSite();
    context.requireUser.mockRejectedValue(new Error('unauthorized'));
    expect((await setCurrentSiteAction(site._id.toString())).success).toBe(false);
    expect(context.cookieSet).not.toHaveBeenCalled();
  });
});
