'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useSite } from '@/components/admin/site-provider';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import {
  deleteLibraryImage,
  fetchMediaList,
  updateLibraryAlt,
  uploadLibraryImage,
  type MediaListResponse,
} from '@/lib/media/library-client';
import type { SerializedMedia } from '@/lib/media/serialize';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const site = useSite();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<MediaListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<SerializedMedia | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [savingAlt, setSavingAlt] = useState(false);
  const [deleting, setDeleting] = useState<SerializedMedia | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteDetail, setDeleteDetail] = useState('');
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!site?.id) {
        setList(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const result = await fetchMediaList(
          site.id,
          { page, limit: 24, search: appliedSearch },
          signal,
        );
        if (!signal?.aborted) setList(result);
      } catch (err) {
        if (signal?.aborted) return;
        const message = err instanceof Error ? err.message : TOAST_MESSAGES.media.listLoadFailed;
        setError(message);
        showToast('error', TOAST_MESSAGES.media.listLoadFailed);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [site?.id, page, appliedSearch, attempt, showToast],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function onUpload(file: File) {
    if (!site?.id) return;
    setUploading(true);
    try {
      await uploadLibraryImage(file, site.id, '');
      showToast('success', TOAST_MESSAGES.media.uploaded);
      setPage(1);
      setAttempt((n) => n + 1);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : TOAST_MESSAGES.media.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void onUpload(file);
  }

  async function saveAlt() {
    if (!editing || !site?.id) return;
    setSavingAlt(true);
    try {
      const updated = await updateLibraryAlt(editing.id, site.id, altDraft);
      setList((current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) => (item.id === updated.id ? updated : item)),
            }
          : current,
      );
      setEditing(null);
      showToast('success', TOAST_MESSAGES.media.altSaved);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : TOAST_MESSAGES.media.altSaveFailed);
    } finally {
      setSavingAlt(false);
    }
  }

  async function remove() {
    if (!deleting || !site?.id || deletePending) return;
    setDeletePending(true);
    setDeleteDetail('');
    try {
      await deleteLibraryImage(deleting.id, site.id);
      showToast('success', TOAST_MESSAGES.media.deleted);
      setDeleting(null);
      const remaining = (list?.data.length ?? 1) - 1;
      if (remaining <= 0 && page > 1) setPage((n) => n - 1);
      else setAttempt((n) => n + 1);
    } catch (err) {
      const references = (err as { references?: { type: string; title: string }[] }).references;
      if (references?.length) {
        const summary = references
          .map((ref) => `${ref.type}: ${ref.title}`)
          .slice(0, 5)
          .join('; ');
        setDeleteDetail(`${TOAST_MESSAGES.media.deleteInUse} ${summary}`);
        showToast('error', TOAST_MESSAGES.media.deleteInUse);
      } else {
        showToast('error', err instanceof Error ? err.message : TOAST_MESSAGES.media.deleteFailed);
        setDeleting(null);
      }
    } finally {
      setDeletePending(false);
    }
  }

  const items = list?.data ?? [];
  const meta = list?.meta;

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Media library</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">
            Images for {site ? site.name : 'this site'}. Every upload is stored in several sizes and
            can be reused from the blog, event and author editors. Add alt text so the image is
            usable for everyone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!site || uploading}
          className="rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Upload image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="sr-only"
          aria-label="Upload an image"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUpload(file);
            event.target.value = '';
          }}
        />
      </header>

      <form
        className="mt-8 max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setAppliedSearch(search.trim());
        }}
      >
        <label className="text-sm font-medium text-stone-700">
          Search images
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by file name or alt text"
            className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 placeholder:text-stone-500"
          />
        </label>
      </form>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-8 min-h-[20rem] rounded-2xl border-2 border-dashed p-3 transition-colors sm:p-4 ${
          dragging ? 'border-orange-500 bg-orange-50' : 'border-transparent'
        }`}
      >
        {!site ? (
          <p className="py-16 text-center text-sm text-stone-600">
            Choose a site to manage its media library.
          </p>
        ) : loading && !items.length ? (
          <p className="py-16 text-center text-sm text-stone-600">Loading images…</p>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-3 text-sm font-semibold text-orange-800 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-600">
            {dragging
              ? 'Drop the image to upload it.'
              : appliedSearch
                ? 'No images match that search.'
                : 'No images in this library yet. Upload one, or drop a file here.'}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                <div className="relative aspect-[4/3] bg-stone-100">
                  <img
                    src={item.sizes.thumbnail.url}
                    alt={item.alt || ''}
                    className="h-full w-full object-cover"
                  />
                  {!item.alt.trim() && (
                    <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                      Missing alt
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 px-3 py-3">
                  <p
                    className="truncate text-sm font-medium text-stone-900"
                    title={item.originalName}
                  >
                    {item.originalName}
                  </p>
                  <p className="text-xs text-stone-500">
                    {item.width}×{item.height} · {formatBytes(item.bytes)}
                  </p>
                  <p className="line-clamp-2 min-h-[2rem] text-xs text-stone-600">
                    {item.alt.trim() || 'No alt text yet.'}
                  </p>
                  <div className="mt-auto flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setAltDraft(item.alt);
                      }}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-orange-800 hover:bg-orange-50"
                    >
                      Edit alt
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleting(item);
                        setDeleteDetail('');
                      }}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600">
          <p>
            {meta.total} {meta.total === 1 ? 'image' : 'images'}
            {meta.totalPages > 1 ? ` · page ${meta.page} of ${meta.totalPages}` : ''}
          </p>
          {meta.totalPages > 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((n) => n + 1)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close alt text editor"
            className="absolute inset-0 bg-black/30"
            onClick={() => setEditing(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-alt-title"
            className="relative w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="edit-alt-title" className="text-lg font-semibold text-stone-950">
              Alt text for {editing.originalName}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Describe what the image shows. This is what a screen reader will speak, and it is used
              when the image is inserted into a post.
            </p>
            <label className="mt-4 block text-sm font-medium text-stone-700">
              <span className="sr-only">Alt text</span>
              <textarea
                value={altDraft}
                maxLength={300}
                rows={3}
                onChange={(event) => setAltDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                placeholder="For example: A red sailing boat in the harbour at dusk"
              />
            </label>
            <p className="mt-1 text-right text-xs text-stone-500">{altDraft.length}/300</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveAlt()}
                disabled={savingAlt}
                className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
              >
                {savingAlt ? 'Saving…' : 'Save alt text'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteDetail('');
          }
        }}
        title="Delete this image?"
        description={
          deleteDetail ||
          `“${deleting?.originalName ?? ''}” will be removed from the library. If a post still uses it, the deletion is refused so you do not leave a broken image.`
        }
        confirmLabel={deletePending ? 'Deleting…' : 'Delete image'}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
