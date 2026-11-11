'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSite } from '@/components/admin/site-provider';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { RowActionsMenu, ROW_ACTION_ITEM_CLASS } from '@/components/admin/row-actions-menu';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';

type EventRow = {
  _id: string;
  title: string;
  slug: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  status: 'draft' | 'publish';
};
export default function EventsPage() {
  const site = useSite();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const { showToast } = useToast();
  useEffect(() => {
    if (!site?.id) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/admin/events', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!Array.isArray(data)) throw new Error('Invalid event list');
        setEvents(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || TOAST_MESSAGES.events.listLoadFailed);
          showToast('error', TOAST_MESSAGES.events.listLoadFailed);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [site?.id, attempt, showToast]);
  async function remove() {
    if (!deleting || deletePending) return;
    setDeletePending(true);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(deleting.slug)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEvents((current) => current.filter((event) => event._id !== deleting._id));
      showToast('success', TOAST_MESSAGES.events.deleted);
      setDeleting(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : TOAST_MESSAGES.events.deleteFailed);
    } finally {
      setDeletePending(false);
    }
  }
  const search = query.trim().toLocaleLowerCase();
  const visible = events.filter(
    (event) =>
      (filter === 'all' || event.status === filter) &&
      `${event.title} ${event.slug}`.toLocaleLowerCase().includes(search),
  );
  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Events</h1>
          <p className="mt-2 text-sm text-stone-600">
            Manage drafts and published events{site ? ` for ${site.name}` : ''}.
          </p>
        </div>
        <Link
          href="/admin/dashboard/events/new"
          className="rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800"
        >
          New event
        </Link>
      </header>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-stone-700">
          Search events
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or slug"
            className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 placeholder:text-stone-500"
          />
        </label>
        <label className="text-sm font-medium text-stone-700">
          Status filter
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 sm:w-44"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="publish">Published</option>
          </select>
        </label>
      </div>
      <p role="status" className="my-4 text-sm text-stone-600">
        {!loading && !error ? `${visible.length} of ${events.length} events` : ''}
      </p>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {loading ? (
          <div role="status" className="space-y-4 p-6">
            <p className="text-sm text-stone-600">Loading events…</p>
            {[1, 2, 3].map((row) => (
              <div key={row} aria-hidden="true" className="h-12 rounded bg-stone-100" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="p-6">
            <h2 className="font-semibold">Events could not be loaded</h2>
            <p className="mt-2 text-sm text-stone-600">
              Your content has not been changed. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((current) => current + 1)}
              className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="font-semibold">
              {events.length === 0 ? 'Create your first event' : 'No events match your filters'}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {events.length === 0
                ? 'Create an event, save it as a draft and publish when it is ready.'
                : 'Try another title or clear the search and status filter.'}
            </p>
            {events.length === 0 ? (
              <Link
                href="/admin/dashboard/events/new"
                className="mt-4 inline-block text-sm font-semibold text-orange-800 underline"
              >
                Create an event
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
                className="mt-4 text-sm font-semibold text-orange-800 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          visible.map((event) => (
            <div
              key={event._id}
              className="flex flex-col gap-4 border-b border-stone-100 p-5 last:border-0 hover:bg-stone-50/70 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  className="break-words font-semibold text-stone-900 underline-offset-4 hover:underline"
                  href={`/admin/dashboard/events/new?slug=${encodeURIComponent(event.slug)}`}
                >
                  {event.title}
                </Link>
                <p className="mt-1 break-all text-xs leading-5 text-stone-600">/{event.slug}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                  <span
                    className={`rounded-md px-2 py-1 font-medium ${event.status === 'publish' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}
                  >
                    {event.status === 'publish' ? 'Published' : 'Draft'}
                  </span>
                  <span>{new Date(event.endAt).getTime() < Date.now() ? 'Past' : 'Upcoming'}</span>
                  <time dateTime={event.startAt}>
                    {new Date(event.startAt).toLocaleString(undefined, {
                      timeZone: event.timeZone,
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}{' '}
                    · {event.timeZone}
                  </time>
                </div>
              </div>
              <RowActionsMenu label={`Actions for ${event.title}`}>
                <Link
                  className={ROW_ACTION_ITEM_CLASS}
                  href={`/admin/dashboard/events/new?slug=${encodeURIComponent(event.slug)}`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleting(event)}
                  className={ROW_ACTION_ITEM_CLASS}
                >
                  Delete
                </button>
              </RowActionsMenu>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !deletePending) setDeleting(null);
        }}
        onConfirm={remove}
        title="Delete this event?"
        description={`“${deleting?.title ?? ''}” will be permanently removed from the CMS. To take it offline while keeping a copy, change its status to draft in the editor.`}
      />
    </section>
  );
}
