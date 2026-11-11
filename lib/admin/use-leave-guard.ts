import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/* Asks before leaving a form with unsaved changes: tab close (native prompt),
   in-app links and browser Back (the shared ConfirmDialog). */

export interface LinkClick {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  target: string;
  hasDownload: boolean;
  href: string;
}

export interface LeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface SentinelMark {
  href: string;
  length: number;
}

// Next.js rewrites history.state on load, so the sentinel is remembered here.
const SENTINEL_MARK_KEY = 'cms-leave-guard:sentinel';

/* After a reload on the sentinel entry, the same URL at the same history
   length means that entry is still ours, so no second one is pushed. */
export function isSentinelEntry(
  mark: SentinelMark | null,
  href: string,
  historyLength: number,
): boolean {
  return mark !== null && mark.href === href && mark.length === historyLength;
}

function readSentinelMark(): SentinelMark | null {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(SENTINEL_MARK_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') {
      const { href, length } = parsed as Partial<SentinelMark>;
      if (typeof href === 'string' && typeof length === 'number') return { href, length };
    }
  } catch {
    // Storage blocked or corrupt: treat as no sentinel.
  }
  return null;
}

function writeSentinelMark(mark: SentinelMark | null): void {
  try {
    if (mark) window.sessionStorage.setItem(SENTINEL_MARK_KEY, JSON.stringify(mark));
    else window.sessionStorage.removeItem(SENTINEL_MARK_KEY);
  } catch {
    // Storage blocked: Back still works, a reload may add one extra entry.
  }
}

type PendingLeave = { kind: 'link'; href: string } | { kind: 'back' };

export function leaveTargetFor(click: LinkClick, currentHref: string): string | null {
  if (click.defaultPrevented || click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (click.hasDownload || (click.target && click.target !== '_self')) return null;
  let current: URL;
  let next: URL;
  try {
    current = new URL(currentHref);
    next = new URL(click.href, current);
  } catch {
    return null;
  }
  if (next.origin !== current.origin) return null;
  if (next.pathname === current.pathname && next.search === current.search) return null;
  return `${next.pathname}${next.search}${next.hash}`;
}

export function useLeaveGuard(
  active: boolean,
  onDiscard: () => void,
): { dialogProps: LeaveDialogProps; leaveTo: (href: string) => void } {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<PendingLeave | null>(null);
  const sentinelRef = useRef(false);
  const releasedRef = useRef(false);
  const activeRef = useRef(active);
  const onDiscardRef = useRef(onDiscard);

  useEffect(() => {
    activeRef.current = active && !releasedRef.current;
    onDiscardRef.current = onDiscard;
  });

  const ask = useCallback((leave: PendingLeave) => {
    pendingRef.current = leave;
    setOpen(true);
  }, []);

  // A duplicate entry for the current URL, so Back lands here first and can ask.
  const pushSentinel = useCallback(() => {
    window.history.pushState(window.history.state, '', window.location.href);
    sentinelRef.current = true;
    writeSentinelMark({ href: window.location.href, length: window.history.length });
  }, []);

  const dropSentinel = useCallback(() => {
    sentinelRef.current = false;
    writeSentinelMark(null);
  }, []);

  // Closing the tab or a hard reload: only the browser's own prompt is allowed.
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  // In-app links: capture phase runs before Next's <Link> handler.
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      if (!activeRef.current) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = leaveTargetFor(
        {
          button: event.button,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
          target: anchor.target,
          hasDownload: anchor.hasAttribute('download'),
          href: anchor.href,
        },
        window.location.href,
      );
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      ask({ kind: 'link', href });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, ask]);

  // Browser Back.
  useEffect(() => {
    if (!active || sentinelRef.current) return;
    if (isSentinelEntry(readSentinelMark(), window.location.href, window.history.length)) {
      sentinelRef.current = true;
    } else {
      pushSentinel();
    }
  }, [active, pushSentinel]);

  useEffect(() => {
    const onPopState = () => {
      if (!sentinelRef.current) return;
      dropSentinel();
      if (activeRef.current) ask({ kind: 'back' });
      else window.history.back(); // Form is clean again: skip the duplicate entry.
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [ask, dropSentinel]);

  const leaveTo = useCallback(
    (href: string) => {
      releasedRef.current = true;
      activeRef.current = false;
      if (sentinelRef.current) {
        dropSentinel();
        router.replace(href); // Reuse the sentinel entry instead of stacking a duplicate.
      } else {
        router.push(href);
      }
    },
    [router, dropSentinel],
  );

  const stay = useCallback(() => {
    const leave = pendingRef.current;
    pendingRef.current = null;
    setOpen(false);
    if (leave?.kind === 'back' && activeRef.current && !sentinelRef.current) pushSentinel();
  }, [pushSentinel]);

  // Radix calls onOpenChange(false) right after this, so pendingRef must be cleared first.
  const discard = useCallback(() => {
    const leave = pendingRef.current;
    pendingRef.current = null;
    setOpen(false);
    if (!leave) return;
    onDiscardRef.current();
    if (leave.kind === 'link') {
      leaveTo(leave.href);
    } else {
      releasedRef.current = true;
      activeRef.current = false;
      window.history.back();
    }
  }, [leaveTo]);

  return {
    dialogProps: {
      open,
      onOpenChange: (next) => {
        if (!next) stay();
      },
      onConfirm: discard,
      title: 'Discard unsaved changes?',
      description: "You have changes that haven't been saved. If you leave now, they'll be lost.",
      confirmLabel: 'Discard',
      cancelLabel: 'Stay',
    },
    leaveTo,
  };
}
