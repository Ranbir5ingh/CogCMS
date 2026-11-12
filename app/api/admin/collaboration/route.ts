import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/http/admin-handler';
import { validationError } from '@/lib/http/errors';
import { getSnapshot } from '@/lib/collaboration/service';
import { resourceQuerySchema } from '@/lib/validation/collaboration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAdmin(async (req, { site }) => {
  const parsed = resourceQuerySchema.safeParse({
    resourceType: req.nextUrl.searchParams.get('resourceType') ?? undefined,
    resourceId: req.nextUrl.searchParams.get('resourceId') ?? undefined,
  });
  if (!parsed.success) throw validationError(parsed.error.flatten(), 'Invalid collaboration query');
  const snapshot = await getSnapshot(site.id, parsed.data.resourceType, parsed.data.resourceId);
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
});
