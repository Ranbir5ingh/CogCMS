'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import {
  HEARTBEAT_INTERVAL_MS,
  SSE_POLL_MS,
  type CollabResourceType,
  type CommentField,
} from '@/lib/collaboration/types';

export type CollabLock = {
  resourceType: CollabResourceType;
  resourceId: string;
  userId: string;
  userName: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
};

export type CollabPresence = {
  userId: string;
  userName: string;
  userRole: 'admin' | 'editor';
  lastSeenAt: string;
  expiresAt: string;
};

export type CollabComment = {
  id: string;
  resourceType: CollabResourceType;
  resourceId: string;
  userId: string;
  userName: string;
  body: string;
  field: CommentField | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CollabSnapshot = {
  lock: CollabLock | null;
  presence: CollabPresence[];
  comments: CollabComment[];
};

export function collaborationConflictMessage(body: {
  code?: string;
  error?: string;
  details?: { updatedAt?: string; lock?: { userName?: string } };
}): string | undefined {
  if (body?.code !== 'CONFLICT') return undefined;
  if (body.details?.updatedAt && !body.details.lock) return TOAST_MESSAGES.collaboration.staleSave;
  return body.error || TOAST_MESSAGES.collaboration.lockHeld;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function snapshotUrl(resourceType: CollabResourceType, resourceId: string, path = ''): string {
  const url = new URL(`/api/admin/collaboration${path}`, window.location.origin);
  url.searchParams.set('resourceType', resourceType);
  url.searchParams.set('resourceId', resourceId);
  return url.pathname + url.search;
}

export function useCollaboration({
  resourceType,
  resourceId,
}: {
  resourceType: CollabResourceType;
  resourceId: string | null;
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [lock, setLock] = useState<CollabLock | null>(null);
  const [presence, setPresence] = useState<CollabPresence[]>([]);
  const [comments, setComments] = useState<CollabComment[]>([]);
  const [transport, setTransport] = useState<'sse' | 'poll' | 'offline'>('offline');
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef<CollabLock | null>(null);
  const viewerRef = useRef<string | null>(null);

  const applySnapshot = useCallback((snapshot: Partial<CollabSnapshot> | null | undefined) => {
    if (!snapshot) return;
    if ('lock' in snapshot) {
      setLock(snapshot.lock ?? null);
      lockRef.current = snapshot.lock ?? null;
    }
    if (Array.isArray(snapshot.presence)) setPresence(snapshot.presence);
    if (Array.isArray(snapshot.comments)) setComments(snapshot.comments);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/session', { cache: 'no-store' })
      .then(async (res) => {
        const body = await readJson(res);
        const user = body.user as { id?: string; name?: string } | undefined;
        if (!cancelled && user?.id) {
          setViewerId(user.id);
          viewerRef.current = user.id;
          setViewerName(user.name ?? null);
        }
      })
      .catch(() => {
        /* session is already required to render the editor */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!resourceId) {
      setLock(null);
      setPresence([]);
      setComments([]);
      setTransport('offline');
      lockRef.current = null;
      return;
    }

    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: number | null = null;
    let beatTimer: number | null = null;
    let esFailures = 0;
    const resource = { resourceType, resourceId };

    const post = async (path: string, body: unknown) => {
      const res = await fetch(`/api/admin/collaboration${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await readJson(res);
      return { res, payload };
    };

    const fetchSnapshot = async () => {
      const res = await fetch(snapshotUrl(resourceType, resourceId), { cache: 'no-store' });
      const payload = (await readJson(res)) as unknown as CollabSnapshot;
      if (!cancelled && res.ok) applySnapshot(payload);
      return payload;
    };

    const startPoll = () => {
      if (pollTimer !== null) return;
      setTransport('poll');
      const tick = () => {
        void fetchSnapshot().catch(() => {
          if (!cancelled) setTransport('offline');
        });
      };
      tick();
      pollTimer = window.setInterval(tick, SSE_POLL_MS);
    };

    const startSse = () => {
      source = new EventSource(snapshotUrl(resourceType, resourceId, '/stream'));
      source.addEventListener('snapshot', (event) => {
        esFailures = 0;
        if (cancelled) return;
        setTransport('sse');
        try {
          applySnapshot(JSON.parse((event as MessageEvent).data) as CollabSnapshot);
        } catch {
          /* ignore a malformed frame */
        }
      });
      source.onerror = () => {
        esFailures += 1;
        if (esFailures >= 2) {
          source?.close();
          source = null;
          startPoll();
        }
      };
    };

    const acquire = async () => {
      const { res, payload } = await post('/locks', { ...resource, action: 'acquire' });
      if (cancelled) return;
      if (res.ok) {
        applySnapshot(payload as unknown as CollabSnapshot);
        setError(null);
        return;
      }
      if (res.status === 409) {
        const details = payload.details as { lock?: CollabLock } | undefined;
        if (details?.lock) {
          setLock(details.lock);
          lockRef.current = details.lock;
        }
        await fetchSnapshot();
        return;
      }
      setError(
        typeof payload.error === 'string' ? payload.error : 'Could not acquire the edit lock.',
      );
      await fetchSnapshot();
    };

    const beat = async () => {
      const { res, payload } = await post('/heartbeat', resource);
      if (!cancelled && res.ok) applySnapshot(payload as unknown as CollabSnapshot);
    };

    void (async () => {
      await acquire();
      if (cancelled) return;
      startSse();
      beatTimer = window.setInterval(() => {
        void beat();
      }, HEARTBEAT_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      source?.close();
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (beatTimer !== null) window.clearInterval(beatTimer);
      const held =
        lockRef.current && viewerRef.current && lockRef.current.userId === viewerRef.current;
      void fetch('/api/admin/collaboration/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resource, action: 'release' }),
        keepalive: true,
      }).catch(() => {
        /* tab is closing */
      });
      void held;
    };
  }, [applySnapshot, resourceId, resourceType]);

  const takeover = useCallback(async () => {
    if (!resourceId) return false;
    const res = await fetch('/api/admin/collaboration/locks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceType, resourceId, action: 'takeover' }),
    });
    const payload = (await readJson(res)) as unknown as CollabSnapshot & { error?: string };
    if (!res.ok) {
      setError(payload.error ?? TOAST_MESSAGES.collaboration.takeoverFailed);
      return false;
    }
    applySnapshot(payload);
    return true;
  }, [applySnapshot, resourceId, resourceType]);

  const addComment = useCallback(
    async (body: string, field?: CommentField | null) => {
      if (!resourceId) return null;
      const res = await fetch('/api/admin/collaboration/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType, resourceId, body, field: field ?? null }),
      });
      const payload = await readJson(res);
      if (!res.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : TOAST_MESSAGES.collaboration.commentFailed,
        );
      }
      const comment = payload as unknown as CollabComment;
      setComments((current) =>
        current.some((row) => row.id === comment.id) ? current : [...current, comment],
      );
      return comment;
    },
    [resourceId, resourceType],
  );

  const patchComment = useCallback(
    async (id: string, patch: { body?: string; resolved?: boolean }) => {
      const res = await fetch(`/api/admin/collaboration/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const payload = await readJson(res);
      if (!res.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Could not update the comment.',
        );
      }
      const comment = payload as unknown as CollabComment;
      setComments((current) => current.map((row) => (row.id === comment.id ? comment : row)));
      return comment;
    },
    [],
  );

  const removeComment = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/collaboration/comments/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const payload = await readJson(res);
    if (!res.ok) {
      throw new Error(
        typeof payload.error === 'string' ? payload.error : 'Could not delete the comment.',
      );
    }
    setComments((current) => current.filter((row) => row.id !== id));
  }, []);

  const isHolder = Boolean(lock && viewerId && lock.userId === viewerId);
  const canEdit = !resourceId || !lock || isHolder;
  const unresolvedCount = useMemo(
    () => comments.filter((comment) => !comment.resolvedAt).length,
    [comments],
  );

  return {
    enabled: Boolean(resourceId),
    viewerId,
    viewerName,
    lock,
    presence,
    comments,
    transport,
    error,
    isHolder,
    canEdit,
    unresolvedCount,
    takeover,
    addComment,
    patchComment,
    removeComment,
  };
}

export type CollaborationApi = ReturnType<typeof useCollaboration>;
