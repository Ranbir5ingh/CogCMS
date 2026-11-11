'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';

const COPIED_RESET_MS = 2000;


export function CopyButton({
  value,
  label = 'Copy key',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      },
      () => showToast('error', TOAST_MESSAGES.sites.keyCopyFailed),
    );
  };

  return (
    <button type="button" onClick={copy} className={className}>
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}
