import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { COLLAB_RESOURCE_TYPES, type CollabResourceType } from '@/lib/collaboration/types';

export interface IContentLock extends Document<Types.ObjectId> {
  siteId: Types.ObjectId;
  resourceType: CollabResourceType;
  resourceId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  acquiredAt: Date;
  heartbeatAt: Date;
  expiresAt: Date;
}

const ContentLockSchema = new Schema<IContentLock>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
    resourceType: { type: String, enum: COLLAB_RESOURCE_TYPES, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    acquiredAt: { type: Date, required: true },
    heartbeatAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'content_locks', versionKey: false },
);

ContentLockSchema.index({ siteId: 1, resourceType: 1, resourceId: 1 }, { unique: true });
ContentLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ContentLock: Model<IContentLock> =
  mongoose.models.ContentLock || mongoose.model<IContentLock>('ContentLock', ContentLockSchema);

export default ContentLock;
