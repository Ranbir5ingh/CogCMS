import type { IMedia } from '@/models/Media';

export function serializeMedia(media: IMedia) {
  return {
    id: media._id.toString(),
    originalName: media.originalName,
    mimeType: media.mimeType,
    bytes: media.bytes,
    width: media.width,
    height: media.height,
    alt: media.alt,
    sizes: media.sizes,
    createdAt: media.createdAt.toISOString(),
    updatedAt: media.updatedAt.toISOString(),
    createdBy: media.createdBy ? media.createdBy.toString() : null,
    updatedBy: media.updatedBy ? media.updatedBy.toString() : null,
  };
}

export type SerializedMedia = ReturnType<typeof serializeMedia>;
