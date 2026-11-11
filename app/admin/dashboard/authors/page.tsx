'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { RowActionsMenu, ROW_ACTION_ITEM_CLASS } from '@/components/admin/row-actions-menu';

type Author = { _id: string; name: string; slug: string; role?: string };

export default function AuthorsListPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorToDelete, setAuthorToDelete] = useState<Author | null>(null);
  const { showToast } = useToast();

  const confirmDelete = async () => {
    if (!authorToDelete) return;
    const target = authorToDelete;
    setAuthorToDelete(null);
    try {
      const response = await fetch(`/api/admin/authors/${encodeURIComponent(target.slug)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        showToast('error', body?.error || TOAST_MESSAGES.authors.deleteFailed);
        return;
      }
      setAuthors((current) => current.filter((a) => a._id !== target._id));
      showToast('success', TOAST_MESSAGES.authors.deleted);
    } catch {
      showToast('error', TOAST_MESSAGES.authors.deleteFailed);
    }
  };

  useEffect(() => {
    fetch('/api/admin/authors', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setAuthors(d);
        } else {
          console.error('API Error:', d);
          showToast('error', d?.error || TOAST_MESSAGES.authors.listLoadFailed);
          setAuthors([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        showToast('error', TOAST_MESSAGES.authors.listLoadFailed);
        setLoading(false);
      });
  }, [showToast]);

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
              Manage Authors
            </h1>
          </div>
          <Link
            href="/admin/dashboard/authors/new"
            className="px-5 py-2.5 text-white rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
            style={{
              background: 'linear-gradient(135deg, #FF751F, #ff9044)',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(255,117,31,0.25)',
            }}
          >
            + New Author
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
            <p className="p-8 text-gray-500 text-center">Loading authors...</p>
          ) : authors.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 mb-2">No authors found.</p>
              <p className="text-sm text-gray-400">Create your first one to get started.</p>
            </div>
          ) : (
            <div>
              {authors.map((author, i) => (
                <div
                  key={author._id}
                  className="px-6 py-5 flex items-center justify-between hover:bg-white/60 transition-colors"
                  style={{
                    borderBottom: i < authors.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base text-[#1a1a1a] mb-1" style={{ fontWeight: 600 }}>
                      {author.name}
                      {author.role && (
                        <span
                          className="ml-2 text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium border border-orange-100"
                          style={{ letterSpacing: '0.02em' }}
                        >
                          {author.role}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400">/{author.slug}</p>
                  </div>
                  <RowActionsMenu label={`Actions for ${author.name}`}>
                    <Link
                      href={`/admin/dashboard/authors/${encodeURIComponent(author.slug)}`}
                      className={ROW_ACTION_ITEM_CLASS}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setAuthorToDelete(author)}
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
        open={!!authorToDelete}
        onOpenChange={(open) => !open && setAuthorToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this author?"
        description="This permanently removes the author profile. Authors used by a published article cannot be deleted until those articles are reassigned."
      />
    </div>
  );
}
