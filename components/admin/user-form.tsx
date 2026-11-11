'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { makeFormStateKey, useSessionFormState } from '@/lib/admin/session-form-state';
import { useLeaveGuard } from '@/lib/admin/use-leave-guard';
import type { AdminSiteView, AdminUserView } from '@/lib/admin/serializers';

function fromUser(user?: AdminUserView) {
  return {
    email: user?.email ?? '',
    name: user?.name ?? '',
    role: user?.role ?? ('editor' as const),
    siteIds: user?.siteIds ?? [],
    status: user?.status ?? ('active' as const),
    password: '',
  };
}

export function UserForm({ user }: { user?: AdminUserView }) {
  const router = useRouter();
  const [sites, setSites] = useState<AdminSiteView[]>([]);
  const [form, setForm] = useState(() => fromUser(user));
  const [showPassword, setShowPassword] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const editing = Boolean(user);
  const initialSnapshot = useMemo(() => JSON.stringify(fromUser(user)), [user]);
  const isDirty = JSON.stringify(form) !== initialSnapshot;
  const { clear: clearFormState } = useSessionFormState({
    storageKey: makeFormStateKey('global', 'user', user?.id),
    value: form,
    isDirty,
    ready: true,
    exclude: ['password'],
    onRestore: (saved) => setForm((prev) => ({ ...prev, ...saved })),
  });
  const leaveGuard = useLeaveGuard(isDirty, clearFormState);

  useEffect(() => {
    fetch('/api/admin/sites', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setSites(Array.isArray(data) ? data : []))
      .catch(() => showToast('error', TOAST_MESSAGES.users.sitesLoadFailed));
  }, [showToast]);

  const inputClass =
    'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-950 outline-none placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100';

  return (
    <>
      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.siteIds.length === 0) {
            setSiteError(TOAST_MESSAGES.users.siteRequired);
            showToast('error', TOAST_MESSAGES.users.siteRequired);
            return;
          }
          setSiteError(null);
          startTransition(async () => {
            const payload = {
              email: form.email,
              name: form.name,
              role: form.role,
              siteIds: form.siteIds,
              status: form.status,
              ...(form.password ? { password: form.password } : {}),
            };
            const response = await fetch(
              editing ? `/api/admin/users/${user!.id}` : '/api/admin/users',
              {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              },
            );
            if (!response.ok) {
              const body = await response.json().catch(() => null);
              showToast('error', body?.error ?? TOAST_MESSAGES.users.saveFailed);
              return;
            }

            showToast(
              'success',
              editing ? TOAST_MESSAGES.users.saved : TOAST_MESSAGES.users.created,
            );
            clearFormState();
            leaveGuard.leaveTo('/admin/dashboard/users');
            router.refresh();
          });
        }}
      >
        <div className="flex flex-col gap-5 border-b border-stone-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin/dashboard/users"
              className="text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              ← Users
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {editing ? 'Edit user' : 'Create user'}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {editing
                ? 'Update access without exposing password hashes or audit fields.'
                : 'Grant only the sites this person needs.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={pending || !isDirty}
              title={isDirty ? undefined : 'Change a value to enable saving'}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Saving...' : editing ? 'Save user' : 'Create user'}
            </button>
          </div>
        </div>

        <div className="max-w-4xl space-y-8">
          <fieldset className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 sm:p-6">
            <legend className="px-2 text-sm font-semibold text-stone-900">Identity</legend>
            <label className="space-y-2 text-sm font-medium text-stone-700">
              <span>
                Name
                <RequiredMark />
              </span>
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-stone-700">
              <span>
                Email
                <RequiredMark />
              </span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-stone-700">
              <span>Role</span>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as 'admin' | 'editor' })
                }
                className={inputClass}
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-stone-700">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as 'active' | 'disabled' })
                }
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-stone-700 sm:col-span-2">
              <span>
                {editing ? 'New password (optional)' : 'Password'}
                {editing ? null : <RequiredMark />}
              </span>
              <div className="relative">
                <input
                  required={!editing}
                  type={showPassword ? 'text' : 'password'}
                  minLength={12}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className={`${inputClass} pr-11`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-400 transition hover:text-stone-700"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {showPassword ? (
                      <>
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.7 3.3 10 8a11.7 11.7 0 0 1-2.1 4.1" />
                        <path d="M6.6 6.6A11.8 11.8 0 0 0 2 12c1.3 4.7 5 8 10 8a10.8 10.8 0 0 0 2.1-.2" />
                      </>
                    ) : (
                      <>
                        <path d="M2 12s3.7-8 10-8 10 8 10 8-3.7 8-10 8S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
              <span className="block text-xs font-normal text-stone-500">12-72 UTF-8 bytes.</span>
            </label>
          </fieldset>

          <fieldset className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <legend className="px-2 text-sm font-semibold text-stone-900">
              Site access
              <RequiredMark />
            </legend>
            <p className="mb-4 text-xs leading-5 text-stone-500">
              Assign at least one site. This user can only reach the sites selected here.
            </p>
            {siteError ? (
              <p role="alert" className="mb-4 text-xs font-medium text-red-600">
                {siteError}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {sites
                .filter((site) => site.status === 'active')
                .map((site) => (
                  <label
                    key={site.id}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-3 text-sm text-stone-700"
                  >
                    <input
                      type="checkbox"
                      checked={form.siteIds.includes(site.id)}
                      onChange={(event) => {
                        setSiteError(null);
                        setForm((current) => ({
                          ...current,
                          siteIds: event.target.checked
                            ? [...current.siteIds, site.id]
                            : current.siteIds.filter((id) => id !== site.id),
                        }));
                      }}
                      className="h-4 w-4 accent-orange-600"
                    />
                    {site.name}
                  </label>
                ))}
              {sites.length === 0 ? (
                <p className="text-sm text-stone-500">Create a site before adding an editor.</p>
              ) : null}
            </div>
          </fieldset>
        </div>
      </form>
      <ConfirmDialog {...leaveGuard.dialogProps} />
    </>
  );
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600">
      {' '}
      *
    </span>
  );
}
