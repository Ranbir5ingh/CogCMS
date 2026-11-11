'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';

type AuthorOpt = { _id: string; name: string; role?: string; avatarUrl?: string };

export default function AuthorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [authors, setAuthors] = useState<AuthorOpt[]>([]);
  const { showToast } = useToast();

  const load = useCallback(() => {
    fetch('/api/admin/authors')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setAuthors(d);
          return;
        }
        showToast('error', d?.error || TOAST_MESSAGES.authors.listLoadFailed);
      })
      .catch(() => showToast('error', TOAST_MESSAGES.authors.listLoadFailed));
  }, [showToast]);

  useEffect(() => {
    load();
    // Refresh when returning to this tab — e.g. after creating an author in the
    // "+ New author" tab — so the new author appears without a full reload.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label
          className="text-[12px] uppercase tracking-wider text-gray-400"
          style={{ fontWeight: 600 }}
        >
          Author
        </label>
        <a
          href="/admin/dashboard/authors/new"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#FF751F] hover:underline"
          style={{ fontWeight: 500 }}
        >
          + New author
        </a>
      </div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="px-3 py-2 rounded-lg border bg-gray-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        style={{ borderColor: 'rgba(0,0,0,0.08)' }}
      >
        <option value="">Site publisher (default)</option>
        {authors.map((a) => (
          <option key={a._id} value={a._id}>
            {a.name}
            {a.role ? ` — ${a.role}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
