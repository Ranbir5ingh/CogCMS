import { MAX_MEDIA_BYTES } from '@/lib/aws-s3';
import { HttpError, validationError } from '@/lib/http/errors';
import { parsePagination } from '@/lib/http/api-query';
import { resolveImageMime } from '@/lib/media/magic';
import { safeOriginalName } from '@/lib/media/keys';
import { getMediaStorage, type MediaStorage } from '@/lib/media/storage';
import { findMediaReferences, type MediaReference } from '@/lib/media/usage';
import { storeVariants } from '@/lib/media/variants';
import { validateImage } from '@/lib/media/validate-image';
import { serializeMedia, type SerializedMedia } from '@/lib/media/serialize';
import Media, { type IMedia } from '@/models/Media';
import type { AuthenticatedUser } from '@/lib/auth/require';
import type { ResolvedSite } from '@/lib/site/context';
import connectToDatabase from '@/lib/mongodb';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function createMediaAsset(input: {
  site: ResolvedSite;
  user: AuthenticatedUser;
  bytes: Buffer;
  filename: string;
  declaredType?: string;
  alt?: string;
  storage?: MediaStorage;
}): Promise<SerializedMedia> {
  if (input.bytes.length < 1 || input.bytes.length > MAX_MEDIA_BYTES) {
    throw validationError(null, 'Choose a supported image between 1 byte and 10 MiB');
  }
  const mimeType = resolveImageMime(input.bytes, input.declaredType);
  await validateImage(input.bytes, mimeType);

  const storage = input.storage ?? getMediaStorage();
  const stored = await storeVariants(storage, input.site.mediaPrefix, mimeType, input.bytes);
  const alt = (input.alt ?? '').trim().slice(0, 300);

  try {
    await connectToDatabase();
    const media = await Media.create({
      siteId: input.site.id,
      originalName: safeOriginalName(input.filename),
      mimeType,
      bytes: input.bytes.length,
      width: stored.width,
      height: stored.height,
      alt,
      sizes: stored.sizes,
      createdBy: input.user.id,
      updatedBy: input.user.id,
    });
    return serializeMedia(media);
  } catch (error) {
    await Promise.all(stored.writtenKeys.map((key) => storage.delete(key).catch(() => undefined)));
    throw error;
  }
}

export async function listMediaAssets(input: {
  siteId: string;
  searchParams: URLSearchParams;
}): Promise<{
  data: SerializedMedia[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { page, limit, skip } = parsePagination(input.searchParams);
  const search = (input.searchParams.get('search') ?? '').trim();
  if (search.length > 100) {
    throw validationError({ search }, 'Search is limited to 100 characters');
  }

  const filter: Record<string, unknown> = { siteId: input.siteId };
  if (search) {
    const literal = escapeRegex(search);
    filter.$or = [
      { originalName: { $regex: literal, $options: 'i' } },
      { alt: { $regex: literal, $options: 'i' } },
    ];
  }

  await connectToDatabase();
  const [total, rows] = await Promise.all([
    Media.countDocuments(filter),
    Media.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).exec(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows.map(serializeMedia),
    meta: { page, limit, total, totalPages },
  };
}

export async function getMediaAsset(siteId: string, id: string): Promise<IMedia> {
  await connectToDatabase();
  const media = await Media.findOne({ _id: id, siteId }).exec();
  if (!media) throw new HttpError(404, 'NOT_FOUND', 'Media not found');
  return media;
}

export async function updateMediaAlt(input: {
  siteId: string;
  id: string;
  userId: string;
  alt: string;
}): Promise<SerializedMedia> {
  const media = await getMediaAsset(input.siteId, input.id);
  media.alt = input.alt.trim().slice(0, 300);
  media.updatedBy = input.userId as unknown as IMedia['updatedBy'];
  await media.save();
  return serializeMedia(media);
}

export async function deleteMediaAsset(input: {
  siteId: string;
  id: string;
  force?: boolean;
  storage?: MediaStorage;
}): Promise<{ deleted: true; references: MediaReference[] }> {
  const media = await getMediaAsset(input.siteId, input.id);
  const references = await findMediaReferences(input.siteId, media);
  if (references.length > 0 && !input.force) {
    throw new HttpError(
      409,
      'CONFLICT',
      'This image is still used by content. Remove it from those items first, or force the deletion.',
      { references },
    );
  }
  const storage = input.storage ?? getMediaStorage();
  const keys = [...new Set(Object.values(media.sizes).map((variant) => variant.key))];
  await Promise.all(keys.map((key) => storage.delete(key)));
  await media.deleteOne();
  return { deleted: true, references };
}
