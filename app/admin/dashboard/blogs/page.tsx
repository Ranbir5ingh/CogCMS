'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSite } from '@/components/admin/site-provider';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { RowActionsMenu, ROW_ACTION_ITEM_CLASS } from '@/components/admin/row-actions-menu';
import { publicUrlFor } from '@/lib/site/urls';

interface Blog {
  _id: string;
  title: string;
  slug: string;
  status?: string;
  tag?: string;
  createdAt: string;
}

export default function AdminBlogsList() {
  const site = useSite();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [blogToDelete, setBlogToDelete] = useState<Blog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch('/api/admin/blogs', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load blogs');
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid blog list');
        if (!controller.signal.aborted) {
          setBlogs(data);
          setState('ready');
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState('error');
        showToast('error', TOAST_MESSAGES.blogs.listLoadFailed);
      });
    return () => controller.abort();
  }, [attempt, showToast]);

  async function confirmDelete() {
    if (!blogToDelete || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/blogs/${encodeURIComponent(blogToDelete.slug)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Delete failed');
      setBlogs((current) => current.filter((blog) => blog._id !== blogToDelete._id));
      showToast('success', TOAST_MESSAGES.blogs.deleted);
      setBlogToDelete(null);
    } catch {
      showToast('error', TOAST_MESSAGES.blogs.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  const search = query.trim().toLocaleLowerCase();
  const visible = blogs.filter(
    (blog) =>
      (filter === 'all' || blog.status === filter) &&
      `${blog.title} ${blog.slug} ${blog.tag ?? ''}`.toLocaleLowerCase().includes(search),
  );

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Blogs</h1>
          <p className="mt-2 text-sm text-stone-600">
            Manage drafts and published articles{site ? ` for ${site.name}` : ''}.
          </p>
        </div>
        <Link
          href="/admin/dashboard/blogs/new"
          className="rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800"
        >
          New blog
        </Link>
      </header>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-stone-700">
          Search blogs
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, slug or tag"
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
        {state === 'ready' ? `${visible.length} of ${blogs.length} posts` : ''}
      </p>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {state === 'loading' ? (
          <div role="status" className="space-y-4 p-6">
            <p className="text-sm text-stone-600">Loading blogs…</p>
            {[1, 2, 3].map((row) => (
              <div key={row} aria-hidden="true" className="h-12 rounded bg-stone-100" />
            ))}
          </div>
        ) : null}
        {state === 'error' ? (
          <div role="alert" className="p-6">
            <h2 className="font-semibold">Blogs could not be loaded</h2>
            <p className="mt-2 text-sm text-stone-600">
              Your content has not been changed. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Try again
            </button>
          </div>
        ) : null}
        {state === 'ready' && visible.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="font-semibold">
              {blogs.length === 0 ? 'Write your first article' : 'No posts match your filters'}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {blogs.length === 0
                ? 'Create a blog, save it as a draft and publish when it is ready.'
                : 'Try another title or clear the search and status filter.'}
            </p>
            {blogs.length > 0 ? (
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
            ) : (
              <Link
                href="/admin/dashboard/blogs/new"
                className="mt-4 inline-block text-sm font-semibold text-orange-800 underline"
              >
                Create a blog
              </Link>
            )}
          </div>
        ) : null}
        {state === 'ready'
          ? visible.map((blog) => (
              <div
                key={blog._id}
                className="flex flex-col gap-4 border-b border-stone-100 p-5 last:border-0 hover:bg-stone-50/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/dashboard/blogs/new?slug=${encodeURIComponent(blog.slug)}`}
                    className="break-words font-semibold text-stone-900 underline-offset-4 hover:underline"
                  >
                    {blog.title}
                  </Link>
                  <p className="mt-1 break-all text-xs leading-5 text-stone-600">/{blog.slug}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                    <span
                      className={`rounded-md px-2 py-1 font-medium ${blog.status === 'publish' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}
                    >
                      {blog.status === 'publish' ? 'Published' : 'Draft'}
                    </span>
                    {blog.tag ? <span>{blog.tag}</span> : null}
                    <time dateTime={blog.createdAt}>
                      Created {new Date(blog.createdAt).toLocaleDateString()}
                    </time>
                  </div>
                </div>
                <RowActionsMenu label={`Actions for ${blog.title}`}>
                  <Link
                    href={`/admin/dashboard/blogs/new?slug=${encodeURIComponent(blog.slug)}`}
                    className={ROW_ACTION_ITEM_CLASS}
                  >
                    Edit
                  </Link>
                  {blog.status === 'publish' && site ? (
                    <a
                      href={publicUrlFor(site, 'blogs', blog.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className={ROW_ACTION_ITEM_CLASS}
                    >
                      View
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setBlogToDelete(blog)}
                    className={ROW_ACTION_ITEM_CLASS}
                  >
                    Delete
                  </button>
                </RowActionsMenu>
              </div>
            ))
          : null}
      </div>
      <ConfirmDialog
        open={Boolean(blogToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setBlogToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete this blog post?"
        description={`“${blogToDelete?.title ?? ''}” will be permanently removed from the CMS. To take it offline while keeping a copy, change its status to draft in the editor.`}
      />
    </section>
  );
}
