import { describe, expect, it } from 'vitest';
import { collaborationConflictMessage } from '@/lib/collaboration/use-collaboration';
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
