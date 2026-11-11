'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSite } from '@/components/admin/site-provider';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { RowActionsMenu, ROW_ACTION_ITEM_CLASS } from '@/components/admin/row-actions-menu';
import { publicUrlFor } from '@/lib/site/urls';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  createdAt: string;
}

interface Submission {
  _id: string;
  question: string;
  name: string;
  email: string;
  status: 'pending' | 'answered' | 'dismissed';
  createdAt: string;
}

export default function AdminFAQsList() {
  const router = useRouter();
  const site = useSite();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/faqs').then((r) => r.json()),
      fetch('/api/admin/faq-submissions').then((r) => r.json()),
    ])
      .then(([faqData, subData]) => {
        if (!Array.isArray(faqData) || !Array.isArray(subData)) {
          showToast('error', faqData?.error || TOAST_MESSAGES.faqs.listLoadFailed);
        }
        setFaqs(Array.isArray(faqData) ? faqData : []);
        setSubmissions(Array.isArray(subData) ? subData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        showToast('error', TOAST_MESSAGES.faqs.listLoadFailed);
        setLoading(false);
      });
  }, [showToast]);

  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    type: 'faq' | 'submission';
  } | null>(null);

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      if (deleteItem.type === 'faq') {
        const res = await fetch(`/api/admin/faqs/${deleteItem.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          setFaqs(faqs.filter((f) => f._id !== deleteItem.id));
          showToast('success', TOAST_MESSAGES.faqs.deleted);
        } else {
          const body = await res.json().catch(() => null);
          showToast('error', body?.error || TOAST_MESSAGES.faqs.deleteFailed);
        }
      } else if (deleteItem.type === 'submission') {
        const res = await fetch(`/api/admin/faq-submissions/${deleteItem.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          setSubmissions(submissions.filter((s) => s._id !== deleteItem.id));
          showToast('success', TOAST_MESSAGES.faqs.submissionDeleted);
        } else {
          const body = await res.json().catch(() => null);
          showToast('error', body?.error || TOAST_MESSAGES.faqs.submissionDeleteFailed);
        }
      }
    } catch (err) {
      console.error(err);
      showToast(
        'error',
        deleteItem.type === 'faq'
          ? TOAST_MESSAGES.faqs.deleteFailed
          : TOAST_MESSAGES.faqs.submissionDeleteFailed,
      );
    } finally {
      setDeleteItem(null);
    }
  };

  const categories = ['All', ...Array.from(new Set(faqs.map((f) => f.category)))];
  const filtered =
    activeCategory === 'All' ? faqs : faqs.filter((f) => f.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#FDFAF7] text-[#1a1a1a]">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-6">
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
              Manage FAQs
            </h1>
          </div>
          <Link
            href="/admin/dashboard/faqs/new"
            className="px-5 py-2.5 text-white rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
            style={{
              background: 'linear-gradient(135deg, #FF751F, #ff9044)',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(255,117,31,0.25)',
            }}
          >
            + Add FAQ
          </Link>
        </div>

        {/* Category filter */}
        {!loading && faqs.length > 0 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors"
                style={{
                  fontWeight: 500,
                  color: activeCategory === cat ? '#FF751F' : '#888',
                  borderColor: activeCategory === cat ? 'rgba(255,117,31,0.3)' : 'rgba(0,0,0,0.08)',
                  background: activeCategory === cat ? 'rgba(255,117,31,0.05)' : 'transparent',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

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
            <p className="p-8 text-gray-500 text-center">Loading FAQs...</p>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 mb-2">No FAQs found.</p>
              <p className="text-sm text-gray-400">Create your first one to get started.</p>
            </div>
          ) : (
            <div>
              {filtered.map((faq, i) => (
                <div
                  key={faq._id}
                  className="px-6 py-5 flex items-start justify-between gap-4 hover:bg-white/60 transition-colors"
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{
                          fontWeight: 600,
                          color: '#FF751F',
                          background: 'rgba(255,117,31,0.06)',
                          border: '1px solid rgba(255,117,31,0.1)',
                        }}
                      >
                        {faq.category}
                      </span>
                    </div>
                    <h3
                      className="text-base text-[#1a1a1a] mb-1 line-clamp-2"
                      style={{ fontWeight: 600 }}
                    >
                      {faq.question}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2">{faq.answer}</p>
                  </div>
                  <div className="shrink-0 mt-1">
                    <RowActionsMenu label={`Actions for FAQ: ${faq.question}`}>
                      <Link
                        href={`/admin/dashboard/faqs/new?id=${faq._id}`}
                        className={ROW_ACTION_ITEM_CLASS}
                      >
                        Edit
                      </Link>
                      {site && (
                        <a
                          href={publicUrlFor(site, 'faq')}
                          target="_blank"
                          rel="noreferrer"
                          className={ROW_ACTION_ITEM_CLASS}
                        >
                          View
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteItem({ id: faq._id, type: 'faq' })}
                        className={ROW_ACTION_ITEM_CLASS}
                      >
                        Delete
                      </button>
                    </RowActionsMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── User Submissions ─────────────────── */}
        {submissions.filter((s) => s.status === 'pending').length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <h2
                className="text-lg"
                style={{
                  fontWeight: 600,
                  color: '#1a1a1a',
                  letterSpacing: '-0.02em',
                }}
              >
                User Questions
              </h2>
              <span
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  fontWeight: 600,
                  color: '#d97706',
                  background: 'rgba(217,119,6,0.08)',
                  border: '1px solid rgba(217,119,6,0.15)',
                }}
              >
                {submissions.filter((s) => s.status === 'pending').length} pending
              </span>
            </div>

            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                borderColor: 'rgba(217,119,6,0.12)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
              }}
            >
              {submissions
                .filter((s) => s.status === 'pending')
                .map((sub, i, arr) => (
                  <div
                    key={sub._id}
                    className="px-6 py-5 flex items-start justify-between gap-4 hover:bg-white/60 transition-colors"
                    style={{
                      borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{
                            fontWeight: 600,
                            color: '#d97706',
                            background: 'rgba(217,119,6,0.06)',
                            border: '1px solid rgba(217,119,6,0.1)',
                          }}
                        >
                          User Asked
                        </span>
                        {sub.name && (
                          <span className="text-[11px] text-gray-400">by {sub.name}</span>
                        )}
                        {sub.email && (
                          <span className="text-[11px] text-gray-300">({sub.email})</span>
                        )}
                      </div>
                      <h3
                        className="text-base text-[#1a1a1a] mb-1 line-clamp-2"
                        style={{ fontWeight: 600 }}
                      >
                        {sub.question}
                      </h3>
                      <p className="text-[11px] text-gray-300">
                        {new Date(sub.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="shrink-0 mt-1">
                      <RowActionsMenu label={`Actions for submission: ${sub.question}`}>
                        <Link
                          href={`/admin/dashboard/faqs/new?question=${encodeURIComponent(sub.question)}`}
                          className={ROW_ACTION_ITEM_CLASS}
                          onClick={async () => {
                            const res = await fetch(`/api/admin/faq-submissions/${sub._id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'answered' }),
                            });
                            if (!res.ok)
                              showToast('error', TOAST_MESSAGES.faqs.submissionUpdateFailed);
                          }}
                        >
                          Create FAQ
                        </Link>
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/admin/faq-submissions/${sub._id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'dismissed' }),
                            });
                            if (!res.ok) {
                              showToast('error', TOAST_MESSAGES.faqs.submissionUpdateFailed);
                              return;
                            }
                            setSubmissions((prev) =>
                              prev.map((s) =>
                                s._id === sub._id ? { ...s, status: 'dismissed' } : s,
                              ),
                            );
                            showToast('success', TOAST_MESSAGES.faqs.submissionDismissed);
                          }}
                          className={ROW_ACTION_ITEM_CLASS}
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteItem({ id: sub._id, type: 'submission' })}
                          className={ROW_ACTION_ITEM_CLASS}
                        >
                          Delete
                        </button>
                      </RowActionsMenu>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Premium Alert Dialog for Deletion */}
      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={confirmDelete}
        title={deleteItem?.type === 'faq' ? 'Delete this FAQ?' : 'Delete this question?'}
        description="Are you absolutely sure? This action cannot be undone and will permanently remove this item from your database."
      />
    </div>
  );
}
