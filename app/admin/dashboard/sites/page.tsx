'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminSiteView } from '@/lib/admin/serializers';
import { RowActionsMenu, ROW_ACTION_ITEM_CLASS } from '@/components/admin/row-actions-menu';

export default function SitesPage() {
  const [sites, setSites] = useState<AdminSiteView[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch('/api/admin/sites', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load sites');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid site list');
        if (!controller.signal.aborted) {
          setSites(data);
          setState('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [attempt]);

  const visible = sites.filter(
    (site) =>
      (status === 'all' || site.status === status) &&
      `${site.name} ${site.primaryDomain} ${site.slug}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sites</h1>
          <p className="mt-2 text-sm text-stone-600">
            Manage each website’s publishing settings and access.
          </p>
        </div>
        <Link
          href="/admin/dashboard/sites/new"
          className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 active:translate-y-px"
        >
          New site
        </Link>
      </div>

      <p className="mt-5 text-sm text-stone-600">
        Connecting a client website?{' '}
        <Link
          href="/admin/dashboard/connect"
          className="font-medium text-orange-800 underline underline-offset-4"
        >
          Read the setup guide and copy the developer prompt.
        </Link>
      </p>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-stone-700">
          Search sites
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, domain or slug"
            className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 placeholder:text-stone-500"
          />
        </label>
        <label className="text-sm font-medium text-stone-700">
          Site status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 sm:w-44"
          >
            <option value="active">Active sites</option>
            <option value="archived">Archived sites</option>
            <option value="all">All sites</option>
          </select>
        </label>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
        {state === 'loading' ? (
          <p className="p-6 text-sm text-stone-500">Loading sites...</p>
        ) : null}
        {state === 'error' ? (
          <div role="alert" className="p-6 text-sm text-red-700">
            Sites could not be loaded.{' '}
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        ) : null}
        {state === 'ready' && sites.length === 0 ? (
          <div className="p-8">
            <h2 className="font-semibold">Connect your first website</h2>
            <p className="mt-2 text-sm text-stone-600">
              Create a site, assign your editors and follow the connection guide with your
              developer.
            </p>
          </div>
        ) : null}
        {state === 'ready' && sites.length > 0 && visible.length === 0 ? (
          <p className="p-6 text-sm text-stone-600">No sites match your search.</p>
        ) : null}
        {state === 'ready'
          ? visible.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 last:border-b-0 hover:bg-stone-50"
              >
                <span className="min-w-0">
                  <span className="block break-words font-medium text-stone-900">{site.name}</span>
                  <span className="mt-1 block break-all text-xs text-stone-600">
                    {site.primaryDomain}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${site.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}
                  >
                    {site.status}
                  </span>
                  <RowActionsMenu label={`Actions for ${site.name}`}>
                    <Link
                      href={`/admin/dashboard/sites/${site.id}`}
                      className={ROW_ACTION_ITEM_CLASS}
                    >
                      Edit
                    </Link>
                  </RowActionsMenu>
                </span>
              </div>
            ))
          : null}
      </div>
    </section>
  );
}
