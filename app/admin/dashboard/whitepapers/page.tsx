'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSite } from '@/components/admin/site-provider';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { RowActionsMenu, ROW_ACTION_ITEM_CLASS } from '@/components/admin/row-actions-menu';
import { publicUrlFor } from '@/lib/site/urls';

interface Whitepaper {
  _id: string;
  title: string;
  slug: string;
  status?: string;
  tag?: string;
  tags?: string[];
  isFeatured?: boolean;
  createdAt: string;
}

export default function AdminWhitepapersList() {
  const site = useSite();
  const [whitepapers, setWhitepapers] = useState<Whitepaper[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetch('/api/admin/whitepapers', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWhitepapers(data);
        } else {
          console.error('API Error:', data);
          showToast('error', data?.error || TOAST_MESSAGES.whitepapers.listLoadFailed);
          setWhitepapers([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        showToast('error', TOAST_MESSAGES.whitepapers.listLoadFailed);
        setLoading(false);
      });
  }, [showToast]);

  const [whitepaperToDelete, setWhitepaperToDelete] = useState<string | null>(null);

  const handleDeleteClick = (slug: string) => {
    setWhitepaperToDelete(slug);
  };

  const confirmDelete = async () => {
    if (!whitepaperToDelete) return;
    try {
      const res = await fetch(`/api/admin/whitepapers/${whitepaperToDelete}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setWhitepapers(whitepapers.filter((b) => b.slug !== whitepaperToDelete));
        showToast('success', TOAST_MESSAGES.whitepapers.deleted);
      } else {
        const body = await res.json().catch(() => null);
        showToast('error', body?.error || TOAST_MESSAGES.whitepapers.deleteFailed);
      }
    } catch (err) {
      console.error(err);
      showToast('error', TOAST_MESSAGES.whitepapers.deleteFailed);
    } finally {
      setWhitepaperToDelete(null);
    }
  };

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
              Manage Whitepapers
            </h1>
          </div>
          <Link
            href="/admin/dashboard/whitepapers/new"
            className="px-5 py-2.5 text-white rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
            style={{
              background: 'linear-gradient(135deg, #FF751F, #ff9044)',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(255,117,31,0.25)',
            }}
          >
            + Create New Whitepaper
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
            <p className="p-8 text-gray-500 text-center">Loading whitepapers...</p>
          ) : whitepapers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 mb-2">No whitepapers found.</p>
              <p className="text-sm text-gray-400">Create your first one to get started.</p>
            </div>
          ) : (
            <div>
              {whitepapers.map((whitepaper, i) => {
                const primaryTag = whitepaper.tag || whitepaper.tags?.[0];
                return (
                  <div
                    key={whitepaper._id}
                    className="px-6 py-5 flex items-center justify-between hover:bg-white/60 transition-colors"
                    style={{
                      borderBottom:
                        i < whitepapers.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    }}
                  >
                    <div className="flex-1">
                      <Link
                        href={`/admin/dashboard/whitepapers/new?slug=${whitepaper.slug}`}
                        className="hover:underline"
                      >
                        <h3
                          className="text-base text-[#1a1a1a] mb-1 flex items-center gap-2"
                          style={{ fontWeight: 600 }}
                        >
                          {whitepaper.title}
                          {whitepaper.status === 'draft' && (
                            <span
                              className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium"
                              style={{ letterSpacing: '0.02em' }}
                            >
                              Draft
                            </span>
                          )}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        {primaryTag && (
                          <span className="text-[10px] uppercase font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                            {primaryTag}
                          </span>
                        )}
                        <p className="text-xs text-gray-400">
                          /{whitepaper.slug} • {new Date(whitepaper.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <RowActionsMenu label={`Actions for ${whitepaper.title}`}>
                      <Link
                        href={`/admin/dashboard/whitepapers/new?slug=${whitepaper.slug}`}
                        className={ROW_ACTION_ITEM_CLASS}
                      >
                        Edit
                      </Link>
                      {whitepaper.status !== 'draft' && site && (
                        <a
                          href={publicUrlFor(site, 'whitepapers', whitepaper.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className={ROW_ACTION_ITEM_CLASS}
                        >
                          View
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(whitepaper.slug)}
                        className={ROW_ACTION_ITEM_CLASS}
                      >
                        Delete
                      </button>
                    </RowActionsMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Premium Alert Dialog for Deletion */}
      <ConfirmDialog
        open={!!whitepaperToDelete}
        onOpenChange={(open) => !open && setWhitepaperToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this whitepaper post?"
        description="Are you absolutely sure you want to delete this content? This action cannot be undone. This will permanently remove the whitepaper post, its metadata, and content from your servers."
      />
    </div>
  );
}
