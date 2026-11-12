import { NextResponse } from 'next/server';
import { readJson, withAdmin } from '@/lib/http/admin-handler';
import { validationError } from '@/lib/http/errors';
import { getSnapshot, heartbeatLock, touchPresence } from '@/lib/collaboration/service';
import { heartbeatSchema } from '@/lib/validation/collaboration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAdmin(async (req, { site, user }) => {
  const parsed = heartbeatSchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid heartbeat');
  const { resourceType, resourceId } = parsed.data;
  await touchPresence(site.id, resourceType, resourceId, user);
  const snapshot = await getSnapshot(site.id, resourceType, resourceId);
  if (snapshot.lock?.userId === user.id) {
    await heartbeatLock(site.id, resourceType, resourceId, user);
    return NextResponse.json(await getSnapshot(site.id, resourceType, resourceId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
});
