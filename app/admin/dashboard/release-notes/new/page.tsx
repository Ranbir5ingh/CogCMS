'use client';

import { Suspense, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import 'react-quill-new/dist/quill.snow.css';
import { useSite } from '@/components/admin/site-provider';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ReleaseNoteCard } from '@/components/preview/release-note-card';
import {
  buildReleaseNoteMarkdown,
  formatHumanDateFromInput,
  parseReleaseNoteFile,
} from '@/lib/release-notes-parser';
import { editorHtmlToMarkdown, markdownToEditorHtml } from '@/lib/release-notes-editor';
import { publicUrlFor } from '@/lib/site/urls';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { makeFormStateKey, useSessionFormState } from '@/lib/admin/session-form-state';
import { useLeaveGuard } from '@/lib/admin/use-leave-guard';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const DEFAULT_BODY = `This release introduces improvements across the platform.

## New Features

### Feature Name

- Describe the new capability
- Explain who benefits

## Fixes

- List reliability improvements`;

const EMPTY_BODY_HTML = '<h2><br></h2>';

// Compared as Markdown with blank lines collapsed: Quill re-serialises loaded
// HTML, so the raw editor HTML can change without any edit by the user.
function releaseNoteSnapshot(version: string, date: string, bodyMarkdown: string): string {
  return JSON.stringify({ version, date, body: bodyMarkdown.replace(/\n+/g, '\n').trim() });
}

function todayDateInput(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ReleaseNoteEditor() {
  const search = useSearchParams();
  const site = useSite();
  const editSlug = search.get('slug');
  const [originalSlug, setOriginalSlug] = useState<string | null>(editSlug);
  const [version, setVersion] = useState('');
  const [date, setDate] = useState(todayDateInput);
  const [bodyHtml, setBodyHtml] = useState(EMPTY_BODY_HTML);
  const [loading, setLoading] = useState(Boolean(editSlug));
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    releaseNoteSnapshot('', todayDateInput(), ''),
  );
  const { showToast } = useToast();

  useEffect(() => {
    if (!editSlug || !site?.id) {
      setOriginalSlug(null);
      setLoading(false);
      setSavedSnapshot(releaseNoteSnapshot('', todayDateInput(), ''));
      return;
    }

    const controller = new AbortController();
    setOriginalSlug(editSlug);
    setVersion('');
    setDate(todayDateInput());
    setBodyHtml(EMPTY_BODY_HTML);
    setLoading(true);
    fetch(`/api/admin/release-notes/${encodeURIComponent(editSlug)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const note = await response.json();
        if (!response.ok) throw new Error(note.error || TOAST_MESSAGES.releaseNotes.loadFailed);
        setVersion(note.version || '');
        setDate(note.dateInput || todayDateInput());
        setBodyHtml(markdownToEditorHtml(note.bodyMarkdown || ''));
        setOriginalSlug(note.slug);
        setSavedSnapshot(
          releaseNoteSnapshot(
            note.version || '',
            note.dateInput || todayDateInput(),
            editorHtmlToMarkdown(markdownToEditorHtml(note.bodyMarkdown || '')),
          ),
        );
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        showToast(
          'error',
          reason instanceof Error ? reason.message : TOAST_MESSAGES.releaseNotes.loadFailed,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [editSlug, site?.id, showToast]);

  const bodyMarkdown = useMemo(() => editorHtmlToMarkdown(bodyHtml), [bodyHtml]);
  const isDirty = releaseNoteSnapshot(version, date, bodyMarkdown) !== savedSnapshot;
  const editorState = useMemo(() => ({ version, date, bodyHtml }), [version, date, bodyHtml]);
  const { clear: clearFormState } = useSessionFormState({
    storageKey: site?.id ? makeFormStateKey(site.id, 'release-note', editSlug) : null,
    value: editorState,
    isDirty,
    ready: !loading,
    onRestore: (saved) => {
      if (typeof saved.version === 'string') setVersion(saved.version);
      if (typeof saved.date === 'string') setDate(saved.date);
      if (typeof saved.bodyHtml === 'string') setBodyHtml(saved.bodyHtml);
    },
  });
  const leaveGuard = useLeaveGuard(isDirty, clearFormState);
  const preview = useMemo(() => {
    const dateLabel = formatHumanDateFromInput(date) || 'January 1, 2026';
    return parseReleaseNoteFile(
      buildReleaseNoteMarkdown(version || 'X.Y', dateLabel, bodyMarkdown || DEFAULT_BODY),
      'preview.md',
    );
  }, [bodyMarkdown, date, version]);
  const modules = useMemo(() => ({ toolbar: '#release-note-toolbar' }), []);

  async function save(status: 'draft' | 'publish') {
    if (!version.trim() || !date || !bodyMarkdown.trim()) {
      showToast('error', TOAST_MESSAGES.releaseNotes.fieldsRequired);
      return;
    }
    setSaving(true);
    try {
      const endpoint = originalSlug
        ? `/api/admin/release-notes/${encodeURIComponent(originalSlug)}`
        : '/api/admin/release-notes';
      const response = await fetch(endpoint, {
        method: originalSlug ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, date, bodyMarkdown, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || TOAST_MESSAGES.releaseNotes.saveFailed);
      showToast(
        'success',
        status === 'publish'
          ? originalSlug
            ? TOAST_MESSAGES.releaseNotes.republished
            : TOAST_MESSAGES.releaseNotes.published
          : TOAST_MESSAGES.releaseNotes.draftSaved,
      );
      clearFormState();
      leaveGuard.leaveTo('/admin/dashboard/release-notes');
    } catch (reason) {
      showToast(
        'error',
        reason instanceof Error ? reason.message : TOAST_MESSAGES.releaseNotes.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  }

  const publicBase = site ? publicUrlFor(site, 'releaseNotes') : '';

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-col gap-5 border-b border-stone-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/dashboard/release-notes"
            className="text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            ← Release notes
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {editSlug ? 'Edit release note' : 'New release note'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => save('draft')}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => save('publish')}
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-sm text-stone-500">Loading release note…</p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-start">
          <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Version"
                name="version"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="3.8"
              />
              <Field
                label="Date"
                name="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Content
              </label>
              <div className="mt-2 min-h-[420px] rounded-xl border border-stone-200 bg-white p-1 [&_.ql-editor>h2:only-child:has(>br:only-child)]:before:pointer-events-none [&_.ql-editor>h2:only-child:has(>br:only-child)]:before:absolute [&_.ql-editor>h2:only-child:has(>br:only-child)]:before:font-normal [&_.ql-editor>h2:only-child:has(>br:only-child)]:before:text-stone-400 [&_.ql-editor>h2:only-child:has(>br:only-child)]:before:content-['Section_title,_e.g._New_Features']">
                <div
                  id="release-note-toolbar"
                  className="rounded-t-lg border-b border-stone-200 bg-stone-50 px-2 py-1.5"
                >
                  <span className="ql-formats">
                    <select className="ql-header" defaultValue="">
                      <option value="">Normal</option>
                      <option value="2">Heading 2</option>
                      <option value="3">Heading 3</option>
                    </select>
                  </span>
                  <span className="ql-formats">
                    <button className="ql-bold" />
                    <button className="ql-link" />
                  </span>
                  <span className="ql-formats">
                    <button className="ql-list" value="ordered" />
                    <button className="ql-list" value="bullet" />
                    <button className="ql-clean" />
                  </span>
                </div>
                <ReactQuill
                  useSemanticHTML={false}
                  theme="snow"
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  modules={modules}
                  formats={['header', 'bold', 'list', 'bullet', 'link']}
                />
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Headings, lists, bold text, and links are stored as Markdown.
              </p>
            </div>
          </div>

          <aside className="sticky top-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Live preview</h2>
              <p className="mt-1 text-xs text-stone-500">
                CMS approximation of the public release-note card.
              </p>
            </div>
            <div className="max-h-[calc(100vh-190px)] overflow-y-auto rounded-2xl border border-stone-200 bg-[#FDFAF7] pb-4 pr-4 pt-2">
              <div className="pointer-events-none">
                <ReleaseNoteCard note={preview} />
              </div>
            </div>
            <p className="mt-4 truncate text-xs text-stone-500">
              URL: {publicBase}#{preview.slug}
            </p>
          </aside>
        </div>
      )}
      <ConfirmDialog {...leaveGuard.dialogProps} />
    </section>
  );
}

function Field({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
      {label}
      <input
        {...input}
        className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900 outline-none focus:ring-2 focus:ring-orange-200"
      />
    </label>
  );
}

export default function ReleaseNoteEditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFAF7]" />}>
      <ReleaseNoteEditor />
    </Suspense>
  );
}
