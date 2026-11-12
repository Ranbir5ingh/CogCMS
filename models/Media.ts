import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const MEDIA_SIZE_NAMES = ['original', 'thumbnail', 'medium', 'large'] as const;
export type MediaSizeName = (typeof MEDIA_SIZE_NAMES)[number];

export interface MediaVariant {
  key: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
}

export type MediaSizes = Record<MediaSizeName, MediaVariant>;

export interface IMedia extends Document<Types.ObjectId> {
  siteId: Types.ObjectId;
  originalName: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  alt: string;
  sizes: MediaSizes;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema(
  {
    key: { type: String, required: true },
    url: { type: String, required: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    bytes: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true },
  },
  { _id: false },
);

const MediaSchema = new Schema<IMedia>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
    originalName: { type: String, required: true, trim: true, maxlength: 200 },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true, min: 1 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    alt: { type: String, default: '', trim: true, maxlength: 300 },
    sizes: {
      original: { type: VariantSchema, required: true },
      thumbnail: { type: VariantSchema, required: true },
      medium: { type: VariantSchema, required: true },
      large: { type: VariantSchema, required: true },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'media' },
);

MediaSchema.index({ siteId: 1, createdAt: -1 });
MediaSchema.index({ siteId: 1, originalName: 1 });

const Media: Model<IMedia> = mongoose.models.Media || mongoose.model<IMedia>('Media', MediaSchema);

export default Media;
