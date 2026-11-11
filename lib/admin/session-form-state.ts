import { useCallback, useEffect, useRef } from 'react';

/* Keeps an admin form's unsaved values in this tab's sessionStorage so a
   refresh brings them back. Nothing leaves the browser, and the copy is gone
   when the tab closes. */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY_PREFIX = 'cms-form:v1';
const WRITE_DELAY_MS = 300;

export function makeFormStateKey(
  scope: string,
  form: string,
  recordKey: string | null | undefined,
): string {
  return `${KEY_PREFIX}:${scope}:${form}:${recordKey || 'new'}`;
}

export function stripFields<T extends object>(data: T, exclude: readonly string[]): Partial<T> {
  const copy = { ...data } as Record<string, unknown>;
  for (const field of exclude) delete copy[field];
  return copy as Partial<T>;
}

export function readFormState<T extends object>(
  storage: StorageLike | null,
  key: string,
): Partial<T> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Partial<T>)
      : null;
  } catch {
    return null;
  }
}

export function writeFormState(
  storage: StorageLike | null,
  key: string,
  data: object,
  exclude: readonly string[] = [],
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(stripFields(data, exclude)));
  } catch {
    // Quota exceeded or storage blocked: the form keeps working without a copy.
  }
}

export function removeFormState(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Storage blocked: nothing to remove.
  }
}

/* The restore render still sees the pre-restore values (clean), so it must not
   delete the copy it is about to apply. */
export function nextMirrorAction({
  isDirty,
  justRestored,
}: {
  isDirty: boolean;
  justRestored: boolean;
}): 'write' | 'remove' | 'keep' {
  if (isDirty) return 'write';
  return justRestored ? 'keep' : 'remove';
}

function sessionStorageOrNull(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function useSessionFormState<T extends object>({
  storageKey,
  value,
  isDirty,
  ready,
  exclude = [],
  onRestore,
}: {
  /** `null` turns the hook off (e.g. the active site is not known yet). */
  storageKey: string | null;
  value: T;
  isDirty: boolean;
  /** True once the form holds its initial values (after an edit fetch). */
  ready: boolean;
  exclude?: readonly string[];
  onRestore: (saved: Partial<T>) => void;
}): { clear: () => void } {
  const restoredKeyRef = useRef<string | null>(null);
  const clearedRef = useRef(false);
  const justRestoredRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  const excludeKey = exclude.join(',');

  useEffect(() => {
    onRestoreRef.current = onRestore;
  });

  // Restore once per record, after the form has its initial values.
  useEffect(() => {
    if (!storageKey || !ready || restoredKeyRef.current === storageKey) return;
    restoredKeyRef.current = storageKey;
    clearedRef.current = false;
    const saved = readFormState<T>(sessionStorageOrNull(), storageKey);
    if (saved) {
      justRestoredRef.current = true;
      onRestoreRef.current(saved);
    }
  }, [storageKey, ready]);

  // Mirror unsaved values; drop the copy once the form matches its saved state.
  useEffect(() => {
    if (!storageKey || !ready || restoredKeyRef.current !== storageKey || clearedRef.current) {
      return;
    }
    const storage = sessionStorageOrNull();
    const action = nextMirrorAction({ isDirty, justRestored: justRestoredRef.current });
    justRestoredRef.current = false;
    if (action === 'keep') return;
    if (action === 'remove') {
      removeFormState(storage, storageKey);
      return;
    }
    const timer = window.setTimeout(() => {
      if (clearedRef.current) return;
      writeFormState(storage, storageKey, value, excludeKey ? excludeKey.split(',') : []);
    }, WRITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [storageKey, ready, isDirty, value, excludeKey]);

  const clear = useCallback(() => {
    clearedRef.current = true;
    if (storageKey) removeFormState(sessionStorageOrNull(), storageKey);
  }, [storageKey]);

  return { clear };
}
