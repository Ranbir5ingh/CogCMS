import { useCallback, useEffect, useRef } from 'react';

/* Quill rewrites loaded HTML it did not produce (e.g. migrated content) and
   reports it through onChange with source "api". Until the user first presses
   a key or pointer, such a change is normalisation, not an edit, so the form's
   saved snapshot should absorb it instead of reporting unsaved changes. */
export function useEditorBaseline(resetKey: string | null): {
  acceptsNormalisation: (source: string) => boolean;
  stop: () => void;
} {
  const acceptingRef = useRef(true);

  useEffect(() => {
    acceptingRef.current = true;
    const stopOnInput = () => {
      acceptingRef.current = false;
    };
    window.addEventListener('pointerdown', stopOnInput, true);
    window.addEventListener('keydown', stopOnInput, true);
    return () => {
      window.removeEventListener('pointerdown', stopOnInput, true);
      window.removeEventListener('keydown', stopOnInput, true);
    };
  }, [resetKey]);

  const acceptsNormalisation = useCallback(
    (source: string) => source !== 'user' && acceptingRef.current,
    [],
  );
  const stop = useCallback(() => {
    acceptingRef.current = false;
  }, []);

  return { acceptsNormalisation, stop };
}
