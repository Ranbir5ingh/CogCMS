'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const ROW_ACTION_ITEM_CLASS =
  'block w-full whitespace-nowrap px-3 py-2 text-left text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50';

export function RowActionsMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
  
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 6,
        right: document.documentElement.clientWidth - rect.right,
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm leading-none text-stone-500 transition-colors hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', top: position.top, right: position.right }}
              className="z-[120] w-max overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
