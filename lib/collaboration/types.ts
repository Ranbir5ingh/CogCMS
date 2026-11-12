export const COLLAB_RESOURCE_TYPES = ['blog', 'event', 'whitepaper'] as const;
export type CollabResourceType = (typeof COLLAB_RESOURCE_TYPES)[number];

export const COMMENT_FIELDS = ['title', 'excerpt', 'content', 'image', 'meta'] as const;
export type CommentField = (typeof COMMENT_FIELDS)[number];

export const LOCK_TTL_MS = 45_000;
export const PRESENCE_TTL_MS = 30_000;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const SSE_POLL_MS = 2_000;

export function isCollabResourceType(value: string): value is CollabResourceType {
  return (COLLAB_RESOURCE_TYPES as readonly string[]).includes(value);
}
