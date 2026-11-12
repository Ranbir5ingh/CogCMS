'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useFocusTrap } from '@/lib/admin/use-focus-trap';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { useToast } from '@/components/admin/toast-provider';
import { COMMENT_FIELDS, type CommentField } from '@/lib/collaboration/types';
import type { CollaborationApi, CollabPresence } from '@/lib/collaboration/use-collaboration';

const AVATAR_COLORS = [
  'bg-orange-100 text-orange-800',
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function Avatar({
  person,
  isHolder,
  isYou,
}: {
  person: Pick<CollabPresence, 'userId' | 'userName'>;
  isHolder: boolean;
  isYou: boolean;
}) {
  const label = `${person.userName}${isYou ? ' (you)' : ''}${isHolder ? ' · editing' : ' · viewing'}`;
  return (
    <span
      title={label}
      className={`relative grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-white ${colorFor(person.userId)}`}
    >
      {initials(person.userName)}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
          isHolder ? 'bg-orange-500' : 'bg-emerald-500'
        }`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function CollaborationPresence({
  collab,
  onToggleComments,
  commentsOpen,
}: {
  collab: CollaborationApi;
  onToggleComments: () => void;
  commentsOpen: boolean;
}) {
  if (!collab.enabled) return null;
  const people = collab.presence;
  const overflow = people.length > 5 ? people.length - 5 : 0;
  const shown = overflow ? people.slice(0, 5) : people;

  return (
    <div className="flex items-center gap-2">
      {people.length > 0 && (
        <div className="flex items-center" aria-label="People currently on this document">
          {shown.map((person, index) => (
            <span key={person.userId} className={index === 0 ? '' : '-ml-2'}>
              <Avatar
                person={person}
                isHolder={collab.lock?.userId === person.userId}
                isYou={collab.viewerId === person.userId}
              />
            </span>
          ))}
          {overflow > 0 && (
            <span className="-ml-2 grid h-8 w-8 place-items-center rounded-full bg-stone-200 text-[10px] font-semibold text-stone-700 ring-2 ring-white">
              +{overflow}
            </span>
          )}
        </div>
      )}
      {collab.transport === 'poll' && (
        <span
          className="hidden text-[10px] font-medium text-stone-400 sm:inline"
          title="Live updates are using polling"
        >
          Polling
        </span>
      )}
      <button
        type="button"
        onClick={onToggleComments}
        aria-pressed={commentsOpen}
        className="relative rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
      >
        Comments
        {collab.unresolvedCount > 0 && (
          <span className="ml-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">
            {collab.unresolvedCount}
          </span>
        )}
      </button>
    </div>
  );
}

export function CollaborationBanner({ collab }: { collab: CollaborationApi }) {
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [taking, setTaking] = useState(false);

  if (!collab.enabled) return null;

  async function confirmTakeover() {
    setTaking(true);
    const ok = await collab.takeover();
    setTaking(false);
    setConfirm(false);
    showToast(
      ok ? 'success' : 'error',
      ok ? TOAST_MESSAGES.collaboration.takeover : TOAST_MESSAGES.collaboration.takeoverFailed,
    );
  }

  if (collab.canEdit && collab.isHolder) {
    return (
      <p className="border-b border-emerald-100 bg-emerald-50 px-6 py-2 text-xs font-medium text-emerald-800">
        You are editing this document. Your lock renews automatically while this page is open.
      </p>
    );
  }

  if (!collab.lock || collab.canEdit)
    return (
      <>
        {collab.error && (
          <p className="border-b border-amber-100 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-800">
            {collab.error}
          </p>
        )}
      </>
    );

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm text-amber-950"
      >
        <p className="font-medium">
          {collab.lock.userName} is currently editing this document. You can review it, and comments
          still work, but saving is paused until they finish or you take over.
        </p>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
        >
          Take over editing
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Take over this document?"
        description={`${collab.lock.userName} may lose unsaved work if they try to save after you take over. The stale-save guard will block their next write if the document has changed.`}
        confirmLabel={taking ? 'Taking over…' : 'Take over'}
        cancelLabel="Not now"
        onConfirm={() => {
          if (!taking) void confirmTakeover();
        }}
      />
    </>
  );
}

const FIELD_LABELS: Record<CommentField, string> = {
  title: 'Title',
  excerpt: 'Excerpt',
  content: 'Body',
  image: 'Image',
  meta: 'SEO / meta',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CommentsSidebar({
  collab,
  open,
  onClose,
}: {
  collab: CollaborationApi;
  open: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [body, setBody] = useState('');
  const [field, setField] = useState<CommentField | ''>('');
  const [showResolved, setShowResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const visible = useMemo(() => {
    const rows = showResolved ? collab.comments : collab.comments.filter((row) => !row.resolvedAt);
    return rows;
  }, [collab.comments, showResolved]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [open, visible.length]);

  useFocusTrap(open && collab.enabled, panelRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!collab.enabled || !open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await collab.addComment(trimmed, field || null);
      setBody('');
      showToast('success', TOAST_MESSAGES.collaboration.commentAdded);
    } catch (error) {
      showToast(
        'error',
        error instanceof Error ? error.message : TOAST_MESSAGES.collaboration.commentFailed,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-stone-200 bg-white shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Comments"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Comments</h2>
          <p className="text-xs text-stone-500">
            {collab.unresolvedCount === 1
              ? '1 open comment'
              : `${collab.unresolvedCount} open comments`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          aria-label="Close comments"
        >
          Close
        </button>
      </div>
      <label className="flex items-center gap-2 border-b border-stone-100 px-5 py-2 text-xs font-medium text-stone-600">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(event) => setShowResolved(event.target.checked)}
        />
        Show resolved
      </label>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {visible.length === 0 && (
          <p className="text-sm text-stone-500">
            {showResolved
              ? 'No comments on this document yet.'
              : 'No open comments. Leave a note for your co-editors.'}
          </p>
        )}
        {visible.map((comment) => {
          const yours = comment.userId === collab.viewerId;
          return (
            <article
              key={comment.id}
              className={`rounded-2xl border p-3 ${
                comment.resolvedAt
                  ? 'border-stone-100 bg-stone-50 opacity-80'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <header className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {comment.userName}
                    {yours ? ' (you)' : ''}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    {formatTime(comment.createdAt)}
                    {comment.field ? ` · ${FIELD_LABELS[comment.field]}` : ''}
                    {comment.resolvedAt ? ' · Resolved' : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100"
                    onClick={() => {
                      void collab
                        .patchComment(comment.id, { resolved: !comment.resolvedAt })
                        .catch((error) => {
                          showToast(
                            'error',
                            error instanceof Error
                              ? error.message
                              : 'Could not update the comment.',
                          );
                        });
                    }}
                  >
                    {comment.resolvedAt ? 'Reopen' : 'Resolve'}
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => {
                      void collab.removeComment(comment.id).catch((error) => {
                        showToast(
                          'error',
                          error instanceof Error ? error.message : 'Could not delete the comment.',
                        );
                      });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </header>
              <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{comment.body}</p>
            </article>
          );
        })}
      </div>
      <form onSubmit={submit} className="border-t border-stone-200 p-4">
        <label className="mb-2 block text-xs font-medium text-stone-600">
          Optional field
          <select
            value={field}
            onChange={(event) => setField(event.target.value as CommentField | '')}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Whole document</option>
            {COMMENT_FIELDS.map((value) => (
              <option key={value} value={value}>
                {FIELD_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Leave a comment for your co-editors…"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-stone-400">{body.trim().length}/2000</span>
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="rounded-xl bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>
    </aside>
  );
}

/** Wires presence, the lock banner and the comments drawer for an editor page. */
export function useCollaborationUi(collab: CollaborationApi) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  return {
    commentsOpen,
    setCommentsOpen,
    presence: (
      <CollaborationPresence
        collab={collab}
        commentsOpen={commentsOpen}
        onToggleComments={() => setCommentsOpen((open) => !open)}
      />
    ),
    banner: <CollaborationBanner collab={collab} />,
    sidebar: (
      <CommentsSidebar collab={collab} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    ),
  };
}
