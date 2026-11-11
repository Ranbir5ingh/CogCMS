'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from './actions';
import { CmsBrand } from '@/components/admin/cms-brand';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';

const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 72;

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [invalidField, setInvalidField] = useState<'email' | 'password' | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((res) => {
        if (active && res.ok) setShowBack(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (trimmedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(trimmedEmail)) {
      setInvalidField('email');
      showToast('error', TOAST_MESSAGES.auth.invalidEmail);
      return;
    }

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      new TextEncoder().encode(password).byteLength > PASSWORD_MAX_BYTES
    ) {
      setInvalidField('password');
      showToast('error', TOAST_MESSAGES.auth.invalidPassword);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      formData.append('rememberMe', rememberMe ? 'true' : 'false');

      const result = await loginAction(formData);
      if ('error' in result) {
        if ('code' in result && result.code === 'RATE_LIMITED') {
          const minutes = Math.max(1, Math.ceil(result.retryAfter / 60));
          showToast(
            'error',
            `${result.error} Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          );
        } else {
          showToast('error', result.error || TOAST_MESSAGES.auth.loginFailed);
        }
      } else if (result.success) {
        router.push('/admin/dashboard');
      }
    });
  };

  return (
    <main className="cms-workspace flex min-h-[100dvh] items-center justify-center bg-stone-50 px-5 py-12 text-stone-950">
      <div className="w-full max-w-md">
        {showBack && (
          <div className="mb-4">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          </div>
        )}
        <div className="mb-8">
          <CmsBrand />
        </div>
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Manage your websites, prepare content and publish with your team.
          </p>
          <form onSubmit={handleLogin} className="mt-7 space-y-5" aria-busy={isPending}>
            <div>
              <label htmlFor="cms-email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="cms-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (invalidField === 'email') setInvalidField(null);
                }}
                placeholder="you@example.com"
                required
                aria-invalid={invalidField === 'email'}
                className={`mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm placeholder:text-stone-500 ${
                  invalidField === 'email' ? 'border-red-600' : 'border-stone-300'
                }`}
              />
            </div>
            <div>
              <label htmlFor="cms-password" className="block text-sm font-medium">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="cms-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (invalidField === 'password') setInvalidField(null);
                  }}
                  required
                  aria-invalid={invalidField === 'password'}
                  className={`w-full rounded-lg border bg-white px-3 py-2.5 pr-10 text-sm ${
                    invalidField === 'password' ? 'border-red-600' : 'border-stone-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-stone-400 hover:text-stone-700"
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
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                name="rememberMe"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 accent-orange-700"
              />
              Keep me signed in on this device
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-orange-700 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
        <p className="mt-6 text-center text-sm leading-6 text-stone-600">
          Need access or a password reset? Contact your CMS administrator.
        </p>
      </div>
    </main>
  );
}
