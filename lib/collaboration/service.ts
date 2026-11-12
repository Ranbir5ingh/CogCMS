import { Types } from 'mongoose';
import { HttpError, notFound, validationError } from '@/lib/http/errors';
import type { AuthenticatedUser } from '@/lib/auth/require';
import ContentComment, { type IContentComment } from '@/models/ContentComment';
import ContentLock, { type IContentLock } from '@/models/ContentLock';
import ContentPresence, { type IContentPresence } from '@/models/ContentPresence';
import {
  LOCK_TTL_MS,
  PRESENCE_TTL_MS,
  type CollabResourceType,
  type CommentField,
} from '@/lib/collaboration/types';
import connectToDatabase from '@/lib/mongodb';

function oid(value: string, label: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value) || !Types.ObjectId.isValid(value)) {
    throw validationError({ [label]: value }, `Invalid ${label}`);
  }
  return new Types.ObjectId(value);
}

export function serializeLock(lock: IContentLock | null) {
  if (!lock) return null;
  return {
    resourceType: lock.resourceType,
    resourceId: lock.resourceId.toString(),
    userId: lock.userId.toString(),
    userName: lock.userName,
    acquiredAt: lock.acquiredAt.toISOString(),
    heartbeatAt: lock.heartbeatAt.toISOString(),
    expiresAt: lock.expiresAt.toISOString(),
  };
}

export function serializePresence(row: IContentPresence) {
  return {
    userId: row.userId.toString(),
    userName: row.userName,
    userRole: row.userRole,
    lastSeenAt: row.lastSeenAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export function serializeComment(row: IContentComment) {
  return {
    id: row._id.toString(),
    resourceType: row.resourceType,
    resourceId: row.resourceId.toString(),
    userId: row.userId.toString(),
    userName: row.userName,
    body: row.body,
    field: row.field,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedBy: row.resolvedBy ? row.resolvedBy.toString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SerializedSnapshot = {
  lock: ReturnType<typeof serializeLock>;
  presence: ReturnType<typeof serializePresence>[];
  comments: ReturnType<typeof serializeComment>[];
};

export async function getSnapshot(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: string,
): Promise<SerializedSnapshot> {
  await connectToDatabase();
  const now = new Date();
  const id = oid(resourceId, 'resourceId');
  const [lock, presence, comments] = await Promise.all([
    ContentLock.findOne({
      siteId,
      resourceType,
      resourceId: id,
      expiresAt: { $gt: now },
    }).exec(),
    ContentPresence.find({
      siteId,
      resourceType,
      resourceId: id,
      expiresAt: { $gt: now },
    })
      .sort({ lastSeenAt: -1 })
      .exec(),
    ContentComment.find({ siteId, resourceType, resourceId: id }).sort({ createdAt: 1 }).exec(),
  ]);
  return {
    lock: serializeLock(lock),
    presence: presence.map(serializePresence),
    comments: comments.map(serializeComment),
  };
}

export async function touchPresence(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: string,
  user: AuthenticatedUser,
  now = new Date(),
): Promise<void> {
  await connectToDatabase();
  const expiresAt = new Date(now.getTime() + PRESENCE_TTL_MS);
  await ContentPresence.findOneAndUpdate(
    { siteId, resourceType, resourceId: oid(resourceId, 'resourceId'), userId: user.id },
    {
      $set: {
        userName: user.name,
        userRole: user.role,
        lastSeenAt: now,
        expiresAt,
      },
      $setOnInsert: { siteId, resourceType, resourceId: oid(resourceId, 'resourceId'), userId: user.id },
    },
    { upsert: true },
  ).exec();
}

async function currentLock(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: Types.ObjectId,
) {
  return ContentLock.findOne({ siteId, resourceType, resourceId }).exec();
}

function heldByOther(lock: IContentLock, userId: string, now: Date): boolean {
  return lock.expiresAt > now && lock.userId.toString() !== userId;
}

export async function acquireLock(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: string,
  user: AuthenticatedUser,
  options: { takeover?: boolean; now?: Date } = {},
): Promise<{ lock: ReturnType<typeof serializeLock>; acquired: boolean }> {
  await connectToDatabase();
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);
  const id = oid(resourceId, 'resourceId');
  const userId = new Types.ObjectId(user.id);

  if (options.takeover) {
    const lock = await ContentLock.findOneAndUpdate(
      { siteId, resourceType, resourceId: id },
      {
        $set: {
          userId,
          userName: user.name,
          acquiredAt: now,
          heartbeatAt: now,
          expiresAt,
        },
        $setOnInsert: { siteId, resourceType, resourceId: id },
      },
      { upsert: true, returnDocument: 'after' },
    ).exec();
    return { lock: serializeLock(lock), acquired: true };
  }

  const claimed = await ContentLock.findOneAndUpdate(
    {
      siteId,
      resourceType,
      resourceId: id,
      $or: [{ expiresAt: { $lte: now } }, { userId }],
    },
    {
      $set: { userId, userName: user.name, heartbeatAt: now, expiresAt, acquiredAt: now },
      $setOnInsert: { siteId, resourceType, resourceId: id },
    },
    { returnDocument: 'after' },
  ).exec();
  if (claimed) {
    return { lock: serializeLock(claimed), acquired: true };
  }

  try {
    const created = await ContentLock.create({
      siteId,
      resourceType,
      resourceId: id,
      userId,
      userName: user.name,
      acquiredAt: now,
      heartbeatAt: now,
      expiresAt,
    });
    return { lock: serializeLock(created), acquired: true };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }

  const existing = await currentLock(siteId, resourceType, id);
  if (existing && !heldByOther(existing, user.id, now)) {
    existing.userId = userId;
    existing.userName = user.name;
    existing.heartbeatAt = now;
    existing.expiresAt = expiresAt;
    if (existing.expiresAt <= now) existing.acquiredAt = now;
    await existing.save();
    return { lock: serializeLock(existing), acquired: true };
  }
  throw new HttpError(409, 'CONFLICT', `${existing?.userName ?? 'Someone'} is currently editing this document.`, {
    lock: serializeLock(existing),
  });
}

export async function heartbeatLock(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: string,
  user: AuthenticatedUser,
  now = new Date(),
): Promise<ReturnType<typeof serializeLock>> {
  await connectToDatabase();
  const id = oid(resourceId, 'resourceId');
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);
  const refreshed = await ContentLock.findOneAndUpdate(
    {
      siteId,
      resourceType,
      resourceId: id,
      userId: user.id,
      expiresAt: { $gt: now },
    },
    { $set: { heartbeatAt: now, expiresAt, userName: user.name } },
    { returnDocument: 'after' },
  ).exec();
  if (!refreshed) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not hold the edit lock for this document.');
  }
  return serializeLock(refreshed);
}

export async function releaseLock(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: string,
  user: AuthenticatedUser,
): Promise<void> {
  await connectToDatabase();
  await ContentLock.deleteOne({
    siteId,
    resourceType,
    resourceId: oid(resourceId, 'resourceId'),
    userId: user.id,
  }).exec();
}

export async function addComment(input: {
  siteId: string;
  resourceType: CollabResourceType;
  resourceId: string;
  user: AuthenticatedUser;
  body: string;
  field?: CommentField | null;
}) {
  const body = input.body.trim();
  if (!body) throw validationError({ body }, 'Comment cannot be empty');
  if (body.length > 2000) throw validationError({ body }, 'Comment must be at most 2000 characters');
  await connectToDatabase();
  const comment = await ContentComment.create({
    siteId: input.siteId,
    resourceType: input.resourceType,
    resourceId: oid(input.resourceId, 'resourceId'),
    userId: input.user.id,
    userName: input.user.name,
    body,
    field: input.field ?? null,
  });
  return serializeComment(comment);
}

export async function listComments(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: string,
) {
  await connectToDatabase();
  const rows = await ContentComment.find({
    siteId,
    resourceType,
    resourceId: oid(resourceId, 'resourceId'),
  })
    .sort({ createdAt: 1 })
    .exec();
  return rows.map(serializeComment);
}

export async function patchComment(input: {
  siteId: string;
  id: string;
  user: AuthenticatedUser;
  body?: string;
  resolved?: boolean;
}) {
  await connectToDatabase();
  const comment = await ContentComment.findOne({
    _id: oid(input.id, 'id'),
    siteId: input.siteId,
  }).exec();
  if (!comment) throw notFound('Comment');
  if (input.body !== undefined) {
    if (comment.userId.toString() !== input.user.id) {
      throw new HttpError(403, 'FORBIDDEN', 'You can only edit your own comments.');
    }
    const body = input.body.trim();
    if (!body) throw validationError({ body }, 'Comment cannot be empty');
    if (body.length > 2000) throw validationError({ body }, 'Comment must be at most 2000 characters');
    comment.body = body;
  }
  if (input.resolved !== undefined) {
    if (input.resolved) {
      comment.resolvedAt = new Date();
      comment.resolvedBy = new Types.ObjectId(input.user.id);
    } else {
      comment.resolvedAt = null;
      comment.resolvedBy = null;
    }
  }
  await comment.save();
  return serializeComment(comment);
}

export async function deleteComment(input: {
  siteId: string;
  id: string;
  user: AuthenticatedUser;
}) {
  await connectToDatabase();
  const comment = await ContentComment.findOne({
    _id: oid(input.id, 'id'),
    siteId: input.siteId,
  }).exec();
  if (!comment) throw notFound('Comment');
  const isAuthor = comment.userId.toString() === input.user.id;
  if (!isAuthor && input.user.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'You can only delete your own comments.');
  }
  await comment.deleteOne();
  return { deleted: true };
}

export async function leavePresence(
  siteId: string,
  resourceType: CollabResourceType,
  resourceId: string,
  user: AuthenticatedUser,
): Promise<void> {
  await connectToDatabase();
  await ContentPresence.deleteOne({
    siteId,
    resourceType,
    resourceId: oid(resourceId, 'resourceId'),
    userId: user.id,
  }).exec();
}
