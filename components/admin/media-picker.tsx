'use client';

import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { useFocusTrap } from '@/lib/admin/use-focus-trap';
import type { MediaSizeName } from '@/models/Media';
import type { SerializedMedia } from '@/lib/media/serialize';
import {
  fetchMediaList,
  uploadLibraryImage,
  updateLibraryAlt,
  type MediaListResponse,
} from '@/lib/media/library-client';
import { useSite } from '@/components/admin/site-provider';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';

export interface MediaPick {
  id: string;
  alt: string;
  url: string;
  width: number;
  height: number;
  size: MediaSizeName;
  media: SerializedMedia;
}

const SIZE_OPTIONS: { id: MediaSizeName; label: string; hint: string }[] = [
  { id: 'thumbnail', label: 'Thumbnail', hint: 'Up to 320px, library and small previews' },
  { id: 'medium', label: 'Medium', hint: 'Up to 768px, inline in an article' },
  { id: 'large', label: 'Large', hint: 'Up to 1280px, covers and heroes' },
  { id: 'original', label: 'Original', hint: 'The file that was uploaded, unchanged' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPicker({
  open,
  onOpenChange,
  onPick,
  defaultSize = 'large',
  title = 'Choose an image',
  requireAlt = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (pick: MediaPick) => void;
  defaultSize?: MediaSizeName;
  title?: string;
  requireAlt?: boolean;
}) {
  const site = useSite();
  const { showToast } = useToast();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<MediaListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<SerializedMedia | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [size, setSize] = useState<MediaSizeName>(defaultSize);
  const [savingAlt, setSavingAlt] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!site?.id || !open) return;
      setLoading(true);
      setError('');
      try {
        const result = await fetchMediaList(
          site.id,
          { page, limit: 12, search: appliedSearch },
          signal,
        );
        setList(result);
      } catch (err) {
        if (signal?.aborted) return;
        const message = err instanceof Error ? err.message : TOAST_MESSAGES.media.listLoadFailed;
        setError(message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [site?.id, page, appliedSearch, open],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (open) {
      setSize(defaultSize);
    } else {
      setSelected(null);
      setSearch('');
      setAppliedSearch('');
      setPage(1);
      setError('');
    }
  }, [open, defaultSize]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);
  useFocusTrap(open, dialogRef);

  function select(item: SerializedMedia) {
    setSelected(item);
    setAltDraft(item.alt);
  }

  async function onUpload(file: File) {
    if (!site?.id) return;
    setUploading(true);
    try {
      const created = await uploadLibraryImage(file, site.id, '');
      showToast('success', TOAST_MESSAGES.media.uploaded);
      setAppliedSearch('');
      setSearch('');
      setPage(1);
      setList((current) =>
        current
          ? {
              data: [created, ...current.data].slice(0, 12),
              meta: {
                ...current.meta,
                total: current.meta.total + 1,
                totalPages: Math.max(1, Math.ceil((current.meta.total + 1) / current.meta.limit)),
              },
            }
          : { data: [created], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
      );
      select(created);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : TOAST_MESSAGES.media.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void onUpload(file);
  }

  async function confirm() {
    if (!selected || !site?.id) return;
    const alt = altDraft.trim();
    if (requireAlt && !alt) {
      showToast('error', TOAST_MESSAGES.media.altRequired);
      return;
    }
    let media = selected;
    if (alt !== selected.alt) {
      setSavingAlt(true);
      try {
        media = await updateLibraryAlt(selected.id, site.id, alt);
        setSelected(media);
        setList((current) =>
          current
            ? {
                ...current,
                data: current.data.map((item) => (item.id === media.id ? media : item)),
              }
            : current,
        );
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : TOAST_MESSAGES.media.altSaveFailed);
        setSavingAlt(false);
        return;
      }
      setSavingAlt(false);
    }
    const variant = media.sizes[size];
    onPick({
      id: media.id,
      alt: media.alt,
      url: variant.url,
      width: variant.width,
      height: variant.height,
      size,
      media,
    });
    onOpenChange(false);
  }

  if (!open) return null;

  const items = list?.data ?? [];
  const meta = list?.meta;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close media picker"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-[81] flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-white shadow-2xl sm:rounded-3xl"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-stone-950">
              {title}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Upload a new image or pick one already in this site&apos;s library. Alt text describes
              the image for people who cannot see it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Close
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <form
              className="flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setAppliedSearch(search.trim());
              }}
            >
              <label className="block text-sm font-medium text-stone-700">
                Search by file name or alt text
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search the library"
                  className="mt-1.5 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 placeholder:text-stone-400"
                />
              </label>
            </form>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !site}
              className="rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="sr-only"
              aria-label="Upload an image to the library"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onUpload(file);
                event.target.value = '';
              }}
            />
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed px-3 py-3 transition-colors ${
              dragging ? 'border-orange-500 bg-orange-50' : 'border-stone-200 bg-stone-50/60'
            }`}
          >
            {loading && !items.length ? (
              <p className="px-3 py-12 text-center text-sm text-stone-600">Loading images…</p>
            ) : error ? (
              <div className="px-3 py-12 text-center">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-3 text-sm font-semibold text-orange-800 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-12 text-center text-sm text-stone-600">
                {dragging
                  ? 'Drop the image to upload it.'
                  : 'No images yet. Upload one, or drop a file here.'}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => select(item)}
                        aria-pressed={active}
                        className={`group flex w-full flex-col overflow-hidden rounded-xl border bg-white text-left transition ${
                          active
                            ? 'border-orange-600 ring-2 ring-orange-200'
                            : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        <span className="relative block aspect-[4/3] bg-stone-100">
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
                        </span>
                        <span className="truncate px-2.5 py-2 text-xs font-medium text-stone-800">
                          {item.originalName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {meta && meta.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between px-1 text-sm text-stone-600">
                <span>
                  Page {meta.page} of {meta.totalPages} ({meta.total} images)
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-lg px-2 py-1 font-medium disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-lg px-2 py-1 font-medium disabled:opacity-40"
                  >
                    Next
                  </button>
                </span>
              </div>
            )}
          </div>

          {selected && (
            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-[160px_1fr]">
              <div className="aspect-square overflow-hidden rounded-xl bg-stone-100">
                <img
                  src={selected.sizes.medium.url}
                  alt={altDraft || selected.alt || ''}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-stone-950">
                  {selected.originalName}{' '}
                  <span className="font-normal text-stone-500">
                    {selected.width}×{selected.height} · {formatBytes(selected.bytes)}
                  </span>
                </p>
                <label className="block text-sm font-medium text-stone-700">
                  Alt text
                  <span className="mt-0.5 block font-normal text-stone-500">
                    Describe the image for screen-reader users. This is required before inserting it
                    into content.
                  </span>
                  <input
                    type="text"
                    value={altDraft}
                    maxLength={300}
                    onChange={(event) => setAltDraft(event.target.value)}
                    placeholder="For example: A red sailing boat in the harbour at dusk"
                    className="mt-1.5 block w-full rounded-lg border border-stone-300 px-3 py-2"
                    aria-required={requireAlt}
                  />
                </label>
                <fieldset>
                  <legend className="text-sm font-medium text-stone-700">Image size</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {SIZE_OPTIONS.map((option) => (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                          size === option.id
                            ? 'border-orange-600 bg-orange-50'
                            : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="media-size"
                          value={option.id}
                          checked={size === option.id}
                          onChange={() => setSize(option.id)}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium text-stone-900">{option.label}</span>
                          <span className="block text-xs text-stone-500">{option.hint}</span>
                          <span className="block text-xs text-stone-500">
                            {selected.sizes[option.id].width}×{selected.sizes[option.id].height}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-stone-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!selected || savingAlt}
            className="rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
          >
            {savingAlt ? 'Saving alt text…' : 'Use this image'}
          </button>
        </footer>
      </div>
    </div>
  );
}
