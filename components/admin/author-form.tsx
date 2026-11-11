'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { useSite } from '@/components/admin/site-provider';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { makeFormStateKey, useSessionFormState } from '@/lib/admin/session-form-state';
import { useLeaveGuard } from '@/lib/admin/use-leave-guard';
import { slugify } from '@/lib/blog-content/slugify';
import { isPublicHttpUrl } from '@/lib/validation/common';

export interface AdminAuthorView {
  _id: string;
  name: string;
  slug: string;
  role?: string;
  bio?: string;
  avatarUrl?: string;
  status?: 'draft' | 'publish';
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fromAuthor(author?: AdminAuthorView) {
  return {
    name: author?.name ?? '',
    slug: author?.slug ?? '',
    role: author?.role ?? '',
    bio: author?.bio ?? '',
    avatarUrl: author?.avatarUrl ?? '',
    status: author?.status ?? ('publish' as const),
  };
}

export function AuthorForm({ author }: { author?: AdminAuthorView }) {
  const router = useRouter();
  const [form, setForm] = useState(() => fromAuthor(author));
  const [errors, setErrors] = useState<{ slug?: string; avatarUrl?: string }>({});
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const editing = Boolean(author);
  const initialSnapshot = useMemo(() => JSON.stringify(fromAuthor(author)), [author]);
  const isDirty = JSON.stringify(form) !== initialSnapshot;
  const site = useSite();
  const { clear: clearFormState } = useSessionFormState({
    storageKey: site?.id ? makeFormStateKey(site.id, 'author', author?.slug) : null,
    value: form,
    isDirty,
    ready: true,
    onRestore: (saved) => setForm((prev) => ({ ...prev, ...saved })),
  });
  const leaveGuard = useLeaveGuard(isDirty, clearFormState);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setErrors((current) => ({ ...current, [key]: undefined }));
      setForm((state) => ({ ...state, [key]: event.target.value }));
    },
  });

  return (
    <>
      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          const slug = form.slug.trim() || slugify(form.name);
          const avatarUrl = form.avatarUrl.trim();
          const nextErrors: { slug?: string; avatarUrl?: string } = {};
          if (!SLUG_PATTERN.test(slug)) nextErrors.slug = TOAST_MESSAGES.authors.invalidSlug;
          if (avatarUrl && !isPublicHttpUrl(avatarUrl)) {
            nextErrors.avatarUrl = TOAST_MESSAGES.authors.invalidAvatarUrl;
          }
          if (nextErrors.slug || nextErrors.avatarUrl) {
            setErrors(nextErrors);
            showToast('error', nextErrors.slug ?? nextErrors.avatarUrl!);
            return;
          }
          setErrors({});

          startTransition(async () => {
            const payload = {
              name: form.name.trim(),
              slug,
              role: form.role.trim(),
              bio: form.bio.trim(),
              avatarUrl,
              status: form.status,
            };
            const response = await fetch(
              editing
                ? `/api/admin/authors/${encodeURIComponent(author!.slug)}`
                : '/api/admin/authors',
              {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              },
            );
            if (!response.ok) {
              const body = await response.json().catch(() => null);
              // Surface the field the server objected to; "Invalid author payload"
              // on its own tells the author nothing about what to change.
              const fieldErrors = body?.details?.fieldErrors as
                Record<string, string[] | undefined> | undefined;
              const slugError = fieldErrors?.slug?.[0];
              const avatarError = fieldErrors?.avatarUrl?.[0];
              if (slugError || avatarError) {
                setErrors({
                  slug: slugError ? TOAST_MESSAGES.authors.invalidSlug : undefined,
                  avatarUrl: avatarError ? TOAST_MESSAGES.authors.invalidAvatarUrl : undefined,
                });
                showToast(
                  'error',
                  slugError
                    ? TOAST_MESSAGES.authors.invalidSlug
                    : TOAST_MESSAGES.authors.invalidAvatarUrl,
                );
                return;
              }
              showToast('error', body?.error ?? TOAST_MESSAGES.authors.saveFailed);
              return;
            }

            showToast('success', TOAST_MESSAGES.authors.saved);
            clearFormState();
            leaveGuard.leaveTo('/admin/dashboard/authors');
            router.refresh();
          });
        }}
      >
        <div className="flex flex-col gap-5 border-b border-stone-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin/dashboard/authors"
              className="text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              ← Authors
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {editing ? 'Edit author' : 'Create author'}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {editing
                ? 'Update the byline shown on published articles.'
                : 'Add a byline for articles on this site.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={pending || !isDirty}
              title={isDirty ? undefined : 'Change a value to enable saving'}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Saving...' : editing ? 'Save author' : 'Create author'}
            </button>
          </div>
        </div>

        <div className="max-w-4xl space-y-8">
          <fieldset className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 sm:p-6">
            <legend className="px-2 text-sm font-semibold text-stone-900">Identity</legend>
            <Field label="Name" required showRequiredMark {...field('name')} />
            <Field
              label="Slug"
              helper="Lowercase kebab-case. Generated from the name if left blank."
              error={errors.slug}
              placeholder="jane-doe"
              {...field('slug')}
            />
            <Field label="Role / title" placeholder="Head of Research" {...field('role')} />
            <label className="space-y-2 text-sm font-medium text-stone-700">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as 'draft' | 'publish' })
                }
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                <option value="publish">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <Field
                label="Avatar URL"
                // Deliberately not type="url": the browser's native bubble would pre-empt
                // the inline message this form shows for every other field.
                inputMode="url"
                helper="Optional. Must be a full http(s) link when provided."
                error={errors.avatarUrl}
                placeholder="https://cdn.example.com/jane.jpg"
                {...field('avatarUrl')}
              />
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <legend className="px-2 text-sm font-semibold text-stone-900">Bio</legend>
            <label className="space-y-2 text-sm font-medium text-stone-700">
              <span className="sr-only">Bio</span>
              <textarea
                {...field('bio')}
                rows={5}
                placeholder="A short biography shown on the public author page."
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-950 outline-none placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </fieldset>
        </div>
      </form>
      <ConfirmDialog {...leaveGuard.dialogProps} />
    </>
  );
}

function Field({
  label,
  helper,
  error,
  showRequiredMark,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
  error?: string;
  showRequiredMark?: boolean;
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-stone-700">
      <span>
        {label}
        {showRequiredMark ? (
          <span aria-hidden="true" className="text-red-600">
            {' '}
            *
          </span>
        ) : null}
      </span>
      <input
        {...input}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-stone-950 outline-none placeholder:text-stone-400 focus:ring-2 ${
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-stone-300 focus:border-orange-400 focus:ring-orange-100'
        }`}
      />
      {error ? (
        <span role="alert" className="block text-xs font-medium text-red-600">
          {error}
        </span>
      ) : helper ? (
        <span className="block text-xs font-normal text-stone-500">{helper}</span>
      ) : null}
    </label>
  );
}
