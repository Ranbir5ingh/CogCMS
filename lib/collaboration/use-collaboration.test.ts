import { describe, expect, it } from 'vitest';
import {
  collaborationConflictMessage,
  shouldAcquireFreedLock,
} from '@/lib/collaboration/use-collaboration';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';

describe('collaborationConflictMessage', () => {
  it('maps a stale-save and a held lock onto editor-facing copy', () => {
    expect(
      collaborationConflictMessage({
        code: 'CONFLICT',
        details: { updatedAt: '2026-11-12T06:19:00.000Z' },
      }),
    ).toBe(TOAST_MESSAGES.collaboration.staleSave);
    expect(
      collaborationConflictMessage({
        code: 'CONFLICT',
        error: 'Aman is currently editing this document.',
        details: { lock: { userName: 'Aman' } },
      }),
    ).toBe('Aman is currently editing this document.');
    expect(collaborationConflictMessage({ code: 'VALIDATION_ERROR' })).toBeUndefined();
  });
});

describe('shouldAcquireFreedLock', () => {
  const free = {
    visible: true,
    alreadyAcquiring: false,
    enabled: true,
  };

  it('claims a missing or expired lease only when the editor is visible and idle', () => {
    expect(shouldAcquireFreedLock({ ...free, lock: null })).toBe(true);
    expect(shouldAcquireFreedLock({ ...free, lock: undefined })).toBe(true);
    expect(
      shouldAcquireFreedLock({ ...free, lock: { expiresAt: '2000-01-01T00:00:00.000Z' } }),
    ).toBe(true);
    expect(
      shouldAcquireFreedLock({
        ...free,
        lock: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
      }),
    ).toBe(false);
  });

  it('does not claim from a hidden tab, while an acquire is in flight, or after unmount', () => {
    expect(shouldAcquireFreedLock({ ...free, lock: null, visible: false })).toBe(false);
    expect(shouldAcquireFreedLock({ ...free, lock: null, alreadyAcquiring: true })).toBe(false);
    expect(shouldAcquireFreedLock({ ...free, lock: null, enabled: false })).toBe(false);
  });
});
