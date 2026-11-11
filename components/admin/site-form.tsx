'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/admin/toast-provider';
import { CopyButton } from '@/components/admin/copy-button';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { makeFormStateKey, useSessionFormState } from '@/lib/admin/session-form-state';
import { useLeaveGuard } from '@/lib/admin/use-leave-guard';
import { useRouter } from 'next/navigation';
import type { AdminSiteView } from '@/lib/admin/serializers';

const defaults = {
  name: '',
  slug: '',
  primaryDomain: '',
  mediaPrefix: '',
  defaultLocale: 'en',
  status: 'active' as const,
  publisherName: '',
  publisherUrl: '',
  publisherLogoUrl: '',
  blogsPath: '/blogs',
  whitepapersPath: '/whitepapers',
  faqPath: '/faq',
  releaseNotesPath: '/release-notes',
  webhookUrl: '',
};

function fromSite(site?: AdminSiteView) {
  if (!site) return defaults;
  return {
    name: site.name,
    slug: site.slug,
    primaryDomain: site.primaryDomain,
    mediaPrefix: site.mediaPrefix,
    defaultLocale: site.defaultLocale,
    status: site.status,
    publisherName: site.publisher.name,
    publisherUrl: site.publisher.url,
    publisherLogoUrl: site.publisher.logoUrl,
    blogsPath: site.publicPaths.blogs,
    whitepapersPath: site.publicPaths.whitepapers,
    faqPath: site.publicPaths.faq,
    releaseNotesPath: site.publicPaths.releaseNotes,
    webhookUrl: site.webhookUrl ?? '',
  };
}

export function SiteForm({ site }: { site?: AdminSiteView }) {
  const router = useRouter();
  const [form, setForm] = useState(() => fromSite(site));
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const editing = Boolean(site);
  const initialSnapshot = useMemo(() => JSON.stringify(fromSite(site)), [site]);
  const isDirty = JSON.stringify(form) !== initialSnapshot;
  const { clear: clearFormState } = useSessionFormState({
    storageKey: makeFormStateKey('global', 'site', site?.id),
    value: form,
    isDirty,
    ready: true,
    onRestore: (saved) => setForm((prev) => ({ ...prev, ...saved })),
  });
  const leaveGuard = useLeaveGuard(isDirty, clearFormState);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <>
      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const payload = {
              name: form.name,
              slug: form.slug,
              primaryDomain: form.primaryDomain,
              mediaPrefix: form.mediaPrefix || undefined,
              defaultLocale: form.defaultLocale,
              status: form.status,
              publisher: {
                name: form.publisherName || form.name,
                url: form.publisherUrl || form.primaryDomain,
                logoUrl: form.publisherLogoUrl,
              },
              publicPaths: {
                blogs: form.blogsPath,
                whitepapers: form.whitepapersPath,
                faq: form.faqPath,
                releaseNotes: form.releaseNotesPath,
              },
              webhookUrl: form.webhookUrl || null,
            };
            const response = await fetch(
              editing ? `/api/admin/sites/${site!.id}` : '/api/admin/sites',
              {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              },
            );
            if (!response.ok) {
              const body = await response.json().catch(() => null);
              showToast('error', body?.error ?? TOAST_MESSAGES.sites.saveFailed);
              return;
            }

            showToast(
              'success',
              editing ? TOAST_MESSAGES.sites.saved : TOAST_MESSAGES.sites.created,
            );
            clearFormState();
            leaveGuard.leaveTo('/admin/dashboard/sites');
            router.refresh();
          });
        }}
      >
        <div className="flex flex-col gap-5 border-b border-stone-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin/dashboard/sites"
              className="text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              ← Sites
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {editing ? 'Edit site' : 'Create site'}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {editing
                ? 'Changes affect site selection and future public contracts.'
                : 'Add an isolated publishing tenant.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={pending || !isDirty}
              title={isDirty ? undefined : 'Change a value to enable saving'}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Saving...' : editing ? 'Save site' : 'Create site'}
            </button>
          </div>
        </div>

        <div className="max-w-4xl space-y-8">
          <fieldset className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 sm:p-6">
            <legend className="px-2 text-sm font-semibold text-stone-900">Identity</legend>
            <Field label="Name" required showRequiredMark {...field('name')} />
            <Field
              label="Slug"
              required
              showRequiredMark
              helper="Lowercase kebab-case"
              {...field('slug')}
            />
            <Field
              label="Public origin"
              type="url"
              required
              showRequiredMark
              {...field('primaryDomain')}
            />
            <Field
              label="Media prefix"
              helper="Defaults to the site slug"
              {...field('mediaPrefix')}
            />
            <Field label="Locale" required {...field('defaultLocale')} />
            <label className="space-y-2 text-sm font-medium text-stone-700">
              <span>Status</span>
              <select
                {...field('status')}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </fieldset>

          {editing ? (
            <fieldset className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
              <legend className="px-2 text-sm font-semibold text-stone-900">Webhook</legend>
              <Field
                label="Consumer webhook URL"
                type="url"
                helper="Called after public content changes"
                {...field('webhookUrl')}
              />
              <WebhookSecretButton siteId={site!.id} />
            </fieldset>
          ) : null}

          <fieldset className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 sm:p-6">
            <legend className="px-2 text-sm font-semibold text-stone-900">Publisher</legend>
            <Field label="Publisher name" {...field('publisherName')} />
            <Field label="Publisher URL" type="url" {...field('publisherUrl')} />
            <div className="sm:col-span-2">
              <Field label="Logo URL" type="url" {...field('publisherLogoUrl')} />
            </div>
          </fieldset>

          <fieldset className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 sm:p-6">
            <legend className="px-2 text-sm font-semibold text-stone-900">Public paths</legend>
            <Field label="Blogs" required {...field('blogsPath')} />
            <Field label="Whitepapers" required {...field('whitepapersPath')} />
            <Field label="FAQ" required {...field('faqPath')} />
            <Field label="Release notes" required {...field('releaseNotesPath')} />
          </fieldset>
        </div>
      </form>
      <ConfirmDialog {...leaveGuard.dialogProps} />
    </>
  );
}

function WebhookSecretButton({ siteId }: { siteId: string }) {
  const [secret, setSecret] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const { showToast } = useToast();

  const generate = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/admin/sites/${siteId}/webhook-secret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        showToast('error', body?.error ?? TOAST_MESSAGES.sites.webhookSecretFailed);
        return;
      }
      setSecret(body.secret);
    } catch {
      showToast('error', TOAST_MESSAGES.sites.webhookSecretFailed);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mt-4">
      {secret ? (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">
            Copy this signing secret now—it cannot be shown again.
          </p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-stone-950 px-3 py-2 text-xs text-stone-50">
            {secret}
          </code>
          <CopyButton
            value={secret}
            label="Copy secret"
            className="mt-3 text-sm font-semibold text-amber-900 underline"
          />
        </div>
      ) : null}
      <button
        type="button"
        disabled={generating}
        onClick={generate}
        className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
      >
        {generating
          ? 'Generating…'
          : secret
            ? 'Generate another secret'
            : 'Generate new signing secret'}
      </button>
    </div>
  );
}

function Field({
  label,
  helper,
  showRequiredMark,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
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
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-950 outline-none placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
      />
      {helper ? <span className="block text-xs font-normal text-stone-500">{helper}</span> : null}
    </label>
  );
}
