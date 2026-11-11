'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { useSite } from '@/components/admin/site-provider';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { makeFormStateKey, useSessionFormState } from '@/lib/admin/session-form-state';
import { useLeaveGuard } from '@/lib/admin/use-leave-guard';

const CATEGORIES = ['Platform', 'Features', 'Pricing', 'Security', 'Strategy'];

const BLANK_FAQ = { question: '', answer: '', category: 'Platform' };

function FAQForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const editId = searchParams.get('id');
  const [loadingFaq, setLoadingFaq] = useState(Boolean(editId));

  // "Create FAQ from submission" opens with the submitted question prefilled.
  const prefillQuestion = searchParams.get('question') ?? '';
  const [formData, setFormData] = useState(() => ({ ...BLANK_FAQ, question: prefillQuestion }));
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({ ...BLANK_FAQ, question: prefillQuestion }),
  );
  const isDirty = JSON.stringify(formData) !== savedSnapshot;
  const site = useSite();
  const { clear: clearFormState } = useSessionFormState({
    storageKey: site?.id
      ? makeFormStateKey(
          site.id,
          'faq',
          editId ?? (prefillQuestion ? `submission:${prefillQuestion}` : null),
        )
      : null,
    value: formData,
    isDirty,
    ready: !loadingFaq,
    onRestore: (saved) => setFormData((prev) => ({ ...prev, ...saved })),
  });
  const leaveGuard = useLeaveGuard(isDirty, clearFormState);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    fetch(`/api/admin/faqs/${editId}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load FAQ');
        const data = await res.json();
        if (!active) return;
        const loaded = {
          question: data.question ?? '',
          answer: data.answer ?? '',
          category: data.category || 'Platform',
        };
        setFormData(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
      })
      .catch(() => active && showToast('error', TOAST_MESSAGES.faqs.loadFailed))
      .finally(() => active && setLoadingFaq(false));
    return () => {
      active = false;
    };
  }, [editId, showToast]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question.trim()) {
      showToast('error', TOAST_MESSAGES.faqs.questionRequired);
      return;
    }
    if (!formData.answer.trim()) {
      showToast('error', TOAST_MESSAGES.faqs.answerRequired);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(editId ? `/api/admin/faqs/${editId}` : '/api/admin/faqs', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || TOAST_MESSAGES.faqs.saveFailed);
        setLoading(false);
        return;
      }
      showToast('success', TOAST_MESSAGES.faqs.saved);
      clearFormState();
      leaveGuard.leaveTo('/admin/dashboard/faqs');
    } catch (err: any) {
      showToast('error', err.message || TOAST_MESSAGES.faqs.saveFailed);
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-5 border-b border-stone-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin/dashboard/faqs"
              className="text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              ← FAQs
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {editId ? 'Edit FAQ' : 'New FAQ'}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {editId
                ? 'Update the published answer for this site.'
                : 'Publish an answer to the public FAQ for this site.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || loadingFaq || !isDirty}
              title={isDirty ? undefined : 'Change a value to enable saving'}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-orange-600 disabled:active:translate-y-0"
            >
              {loading ? 'Saving...' : 'Save FAQ'}
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Category
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900 outline-none focus:ring-2 focus:ring-orange-200"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Question
              <input
                type="text"
                name="question"
                value={formData.question}
                onChange={handleChange}
                placeholder="e.g. How does the platform protect customer data?"
                required
                className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Answer
              <textarea
                name="answer"
                value={formData.answer}
                onChange={handleChange}
                placeholder="Write a comprehensive answer..."
                required
                className="h-[240px] max-h-[50vh] resize-y overflow-y-auto rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-normal normal-case leading-relaxed tracking-normal text-stone-900 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-orange-200"
              />
              <span className="text-right text-xs font-normal normal-case tracking-normal text-stone-400">
                {formData.answer.length} characters
              </span>
            </label>
          </div>

          <aside className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex-none">
              <h2 className="text-sm font-semibold">Live preview</h2>
              <p className="mt-1 text-xs text-stone-500">How this entry reads on the public FAQ.</p>
            </div>
            {formData.question ? (
              <div className="min-h-0 flex-1 lg:relative">
                <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-orange-100 bg-orange-50/40 p-4 lg:absolute lg:inset-0 lg:max-h-none">
                  <span className="mb-3 inline-block rounded-md border border-orange-100 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-700">
                    {formData.category}
                  </span>
                  <h3 className="mb-2 text-base font-semibold text-stone-900">
                    {formData.question}
                  </h3>
                  <p className="text-sm leading-relaxed text-stone-600">
                    {formData.answer || 'Answer preview will appear here...'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500">
                Start typing a question to see how it will look.
              </p>
            )}
          </aside>
        </div>
      </form>
      <ConfirmDialog {...leaveGuard.dialogProps} />
    </>
  );
}

export default function NewFAQPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFAF7]" />}>
      <FAQForm />
    </Suspense>
  );
}
