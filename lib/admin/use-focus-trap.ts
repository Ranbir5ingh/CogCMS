'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

/** Moves focus into a modal when it opens, cycles Tab inside it, and restores focus on close. */
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    if (root === null) return;
    const dialog: HTMLElement = root;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial = focusableIn(dialog);
    (initial[0] ?? dialog).focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const current = focusableIn(dialog);
      if (current.length === 0) {
        event.preventDefault();
        return;
      }
      const activeElement = document.activeElement;
      const index = activeElement instanceof HTMLElement ? current.indexOf(activeElement) : -1;
      if (event.shiftKey) {
        if (index <= 0) {
          event.preventDefault();
          current[current.length - 1]?.focus();
        }
      } else if (index === current.length - 1) {
        event.preventDefault();
        current[0]?.focus();
      }
    }

    dialog.addEventListener('keydown', onKey);
    return () => {
      dialog.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [active, containerRef]);
}
