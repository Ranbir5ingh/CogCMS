import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import {
  COLLAB_RESOURCE_TYPES,
  COMMENT_FIELDS,
  type CollabResourceType,
  type CommentField,
} from '@/lib/collaboration/types';

export interface IContentComment extends Document<Types.ObjectId> {
  siteId: Types.ObjectId;
  resourceType: CollabResourceType;
  resourceId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  body: string;
  field: CommentField | null;
  resolvedAt: Date | null;
  resolvedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ContentCommentSchema = new Schema<IContentComment>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
    resourceType: { type: String, enum: COLLAB_RESOURCE_TYPES, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    field: { type: String, enum: COMMENT_FIELDS, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'content_comments' },
);

ContentCommentSchema.index({ siteId: 1, resourceType: 1, resourceId: 1, createdAt: 1 });

const ContentComment: Model<IContentComment> =
  mongoose.models.ContentComment ||
  mongoose.model<IContentComment>('ContentComment', ContentCommentSchema);

export default ContentComment;
