import { NextResponse } from 'next/server';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { validationError } from '@/lib/http/errors';
import { acquireLock, releaseLock, getSnapshot, touchPresence } from '@/lib/collaboration/service';
import { lockActionSchema } from '@/lib/validation/collaboration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAdmin(
  async (req, { site, user }) => {
    const parsed = lockActionSchema.safeParse(await readJson(req));
    if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid lock request');
    const { resourceType, resourceId, action } = parsed.data;
    await touchPresence(site.id, resourceType, resourceId, user);
    if (action === 'release') {
      await releaseLock(site.id, resourceType, resourceId, user);
      return NextResponse.json(await getSnapshot(site.id, resourceType, resourceId), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const result = await acquireLock(site.id, resourceType, resourceId, user, {
      takeover: action === 'takeover',
    });
    return NextResponse.json(
      { ...result, ...(await getSnapshot(site.id, resourceType, resourceId)) },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  },
  { contentType: 'jsonOrText' },
);
