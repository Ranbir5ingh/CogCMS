'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSite } from '@/components/admin/site-provider';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';

interface Subscriber {
  _id: string;
  email: string;
  source: string;
  submitCount: number;
  firstSubscribedAt: string;
  lastSubscribedAt: string;
}

export default function SubscribersPage() {
  const site = useSite();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    if (!site?.id) {
      setSubscribers([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetch('/api/admin/newsletter-subscribers', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || TOAST_MESSAGES.subscribers.listLoadFailed);
        setSubscribers(Array.isArray(body) ? body : []);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        showToast(
          'error',
          reason instanceof Error ? reason.message : TOAST_MESSAGES.subscribers.listLoadFailed,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [site?.id, showToast]);

  return (
    <div className="min-h-screen bg-[#FDFAF7] text-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-8 py-12">
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
              Manage Subscribers
            </h1>
            {/* Previous header lines, kept for reference:
            <p className="text-sm font-medium text-orange-700">{site?.name}</p>
            <p className="mt-2 text-sm text-stone-600">
              Site-scoped newsletter signups and repeat submissions.
            </p>
            */}
          </div>
          <a
            href="/api/admin/newsletter-subscribers?format=csv"
            className="px-5 py-2.5 text-white rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
            style={{
              background: 'linear-gradient(135deg, #FF751F, #ff9044)',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(255,117,31,0.25)',
            }}
          >
            Export CSV
          </a>
        </div>

        <div
          className="rounded-2xl border overflow-x-auto"
          style={{
            backgroundColor: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            borderColor: 'rgba(0,0,0,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
          }}
        >
          {loading ? (
            <p className="p-8 text-gray-500 text-center">Loading subscribers...</p>
          ) : subscribers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 mb-2">No subscribers found.</p>
              <p className="text-sm text-gray-400">
                Signups from this site&apos;s newsletter form will appear here.
              </p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr
                  className="text-[11px] uppercase tracking-wider text-gray-400"
                  style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Source</th>
                  <th className="px-6 py-3 font-semibold">Submissions</th>
                  <th className="px-6 py-3 font-semibold">First subscribed</th>
                  <th className="px-6 py-3 font-semibold">Latest</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((subscriber, i) => (
                  <tr
                    key={subscriber._id}
                    className="hover:bg-white/60 transition-colors"
                    style={{
                      borderBottom:
                        i < subscribers.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    }}
                  >
                    <td className="px-6 py-5 text-[#1a1a1a]" style={{ fontWeight: 600 }}>
                      {subscriber.email}
                    </td>
                    <td className="px-6 py-5 text-gray-500">{subscriber.source}</td>
                    <td className="px-6 py-5 tabular-nums text-gray-500">
                      {subscriber.submitCount}
                    </td>
                    <td className="px-6 py-5 text-gray-500">
                      {new Date(subscriber.firstSubscribedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-5 text-gray-500">
                      {new Date(subscriber.lastSubscribedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
