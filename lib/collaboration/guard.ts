import type { AuthenticatedUser } from '@/lib/auth/require';
import { HttpError, validationError } from '@/lib/http/errors';
import { getSnapshot } from '@/lib/collaboration/service';
import type { CollabResourceType } from '@/lib/collaboration/types';

/** Pull an optional optimistic-concurrency token off a write body. */
export function takeExpectedUpdatedAt(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const value = (body as Record<string, unknown>).expectedUpdatedAt;
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw validationError(
      { expectedUpdatedAt: value },
      'expectedUpdatedAt must be an ISO-8601 timestamp',
    );
  }
  if (Number.isNaN(Date.parse(value))) {
    throw validationError(
      { expectedUpdatedAt: value },
      'expectedUpdatedAt must be an ISO-8601 timestamp',
    );
  }
  return value;
}

export function assertFreshWrite(existingUpdatedAt: Date, expected?: string): void {
  if (!expected) return;
  if (existingUpdatedAt.getTime() !== Date.parse(expected)) {
    throw new HttpError(
      409,
      'CONFLICT',
      'This document changed while you were editing. Reload before saving.',
      { updatedAt: existingUpdatedAt.toISOString() },
    );
  }
}

export async function assertEditable(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: string,
  user: AuthenticatedUser,
): Promise<void> {
  const { lock } = await getSnapshot(siteId, resourceType, resourceId);
  if (lock && lock.userId !== user.id) {
    throw new HttpError(409, 'CONFLICT', `${lock.userName} is currently editing this document.`, {
      lock,
    });
  }
}
