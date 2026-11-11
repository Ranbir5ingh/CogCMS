'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSite } from '@/components/admin/site-provider';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { RowActionsMenu, ROW_ACTION_ITEM_CLASS } from '@/components/admin/row-actions-menu';
import { publicUrlFor } from '@/lib/site/urls';

interface ReleaseNoteRow {
  _id: string;
  slug: string;
  version: string;
  dateInput: string;
  status: 'draft' | 'publish';
}

export default function ReleaseNotesPage() {
  const site = useSite();
  const [notes, setNotes] = useState<ReleaseNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    if (!site?.id) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetch('/api/admin/release-notes', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || TOAST_MESSAGES.releaseNotes.listLoadFailed);
        setNotes(Array.isArray(body) ? body : []);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        showToast(
          'error',
          reason instanceof Error ? reason.message : TOAST_MESSAGES.releaseNotes.listLoadFailed,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [site?.id, showToast]);

  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  async function confirmDelete() {
    if (!noteToDelete) return;
    const slug = noteToDelete;
    try {
      const response = await fetch(`/api/admin/release-notes/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setNotes((current) => current.filter((note) => note.slug !== slug));
        showToast('success', TOAST_MESSAGES.releaseNotes.deleted);
        return;
      }
      const body = await response.json().catch(() => null);
      showToast('error', body?.error || TOAST_MESSAGES.releaseNotes.deleteFailed);
    } catch {
      showToast('error', TOAST_MESSAGES.releaseNotes.deleteFailed);
    } finally {
      setNoteToDelete(null);
    }
  }

  const publicBase = site ? publicUrlFor(site, 'releaseNotes') : null;

  return (
    <div className="min-h-screen bg-[#FDFAF7] text-[#1a1a1a]">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="text-gray-400 hover:text-gray-800 transition-colors"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1
              className="text-2xl md:text-3xl"
              style={{
                fontWeight: 600,
                color: '#1a1a1a',
                letterSpacing: '-0.03em',
              }}
            >
              Manage Release Notes
            </h1>
          </div>
          <Link
            href="/admin/dashboard/release-notes/new"
            className="px-5 py-2.5 text-white rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
            style={{
              background: 'linear-gradient(135deg, #FF751F, #ff9044)',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(255,117,31,0.25)',
            }}
          >
            + Create New Release Note
          </Link>
        </div>

        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            borderColor: 'rgba(0,0,0,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
          }}
        >
          {loading ? (
            <p className="p-8 text-gray-500 text-center">Loading release notes...</p>
          ) : notes.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 mb-2">No release notes found.</p>
              <p className="text-sm text-gray-400">Create your first one to get started.</p>
            </div>
          ) : (
            <div>
              {notes.map((note, i) => (
                <div
                  key={note._id}
                  className="px-6 py-5 flex items-center justify-between hover:bg-white/60 transition-colors"
                  style={{
                    borderBottom: i < notes.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  }}
                >
                  <div className="flex-1">
                    <Link
                      href={`/admin/dashboard/release-notes/new?slug=${encodeURIComponent(note.slug)}`}
                      className="hover:underline"
                    >
                      <h3
                        className="text-base text-[#1a1a1a] mb-1 flex items-center gap-2"
                        style={{ fontWeight: 600 }}
                      >
                        Version {note.version}
                        {note.status === 'draft' && (
                          <span
                            className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium"
                            style={{ letterSpacing: '0.02em' }}
                          >
                            Draft
                          </span>
                        )}
                      </h3>
                    </Link>
                    <p className="text-xs text-gray-400 mt-1">
                      /{note.slug} • {note.dateInput}
                    </p>
                  </div>
                  <RowActionsMenu label={`Actions for release note ${note.version}`}>
                    <Link
                      href={`/admin/dashboard/release-notes/new?slug=${encodeURIComponent(note.slug)}`}
                      className={ROW_ACTION_ITEM_CLASS}
                    >
                      Edit
                    </Link>
                    {note.status === 'publish' && publicBase ? (
                      <a
                        href={`${publicBase}#${encodeURIComponent(note.slug)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={ROW_ACTION_ITEM_CLASS}
                      >
                        View
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setNoteToDelete(note.slug)}
                      className={ROW_ACTION_ITEM_CLASS}
                    >
                      Delete
                    </button>
                  </RowActionsMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!noteToDelete}
        onOpenChange={(open) => !open && setNoteToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this release note?"
        description="Are you absolutely sure you want to delete this release note? This action cannot be undone. It will be removed from this site's release notes."
      />
    </div>
  );
}
