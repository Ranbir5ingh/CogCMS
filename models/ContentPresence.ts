import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { COLLAB_RESOURCE_TYPES, type CollabResourceType } from '@/lib/collaboration/types';
import type { UserRole } from '@/models/User';

export interface IContentPresence extends Document<Types.ObjectId> {
  siteId: Types.ObjectId;
  resourceType: CollabResourceType;
  resourceId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userRole: UserRole;
  lastSeenAt: Date;
  expiresAt: Date;
}

const ContentPresenceSchema = new Schema<IContentPresence>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
    resourceType: { type: String, enum: COLLAB_RESOURCE_TYPES, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    userRole: { type: String, enum: ['admin', 'editor'], required: true },
    lastSeenAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'content_presences', versionKey: false },
);

ContentPresenceSchema.index(
  { siteId: 1, resourceType: 1, resourceId: 1, userId: 1 },
  { unique: true },
);
ContentPresenceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ContentPresence: Model<IContentPresence> =
  mongoose.models.ContentPresence ||
  mongoose.model<IContentPresence>('ContentPresence', ContentPresenceSchema);

export default ContentPresence;
