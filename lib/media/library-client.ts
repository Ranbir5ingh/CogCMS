import type { SerializedMedia } from '@/lib/media/serialize';
import {
  compressedFileFrom,
  shouldCompressOnClient,
  CLIENT_UPLOAD_OUTPUT_TYPE,
} from '@/lib/media/compress-output';

export type MediaListResponse = {
  data: SerializedMedia[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === 'string' ? payload.error : fallback;
}

export async function fetchMediaList(
  siteId: string,
  query: { page?: number; limit?: number; search?: string } = {},
  signal?: AbortSignal,
): Promise<MediaListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search?.trim()) params.set('search', query.search.trim());
  const qs = params.toString();
  const response = await fetch(`/api/admin/media${qs ? `?${qs}` : ''}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'x-cms-site': siteId },
    signal,
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not load the media library.'));
  return response.json() as Promise<MediaListResponse>;
}

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image uploads are allowed');
  }
  if (!shouldCompressOnClient(file)) return file;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to process image'));
    image.src = dataUrl;
  });
  const maxEdge = 2560;
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to initialize image compression');
  context.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, CLIENT_UPLOAD_OUTPUT_TYPE, 0.85),
  );
  if (!blob) throw new Error('Failed to compress image');
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('Image is still too large after compression. Please use a smaller image.');
  }
  return compressedFileFrom(blob, CLIENT_UPLOAD_OUTPUT_TYPE, file.name);
}

export async function uploadLibraryImage(
  file: File,
  siteId: string,
  alt = '',
  signal?: AbortSignal,
): Promise<SerializedMedia> {
  const uploadFile = await compressImageIfNeeded(file);
  const form = new FormData();
  form.append('file', uploadFile);
  form.append('alt', alt);
  const response = await fetch('/api/admin/media', {
    method: 'POST',
    headers: { 'x-cms-site': siteId },
    body: form,
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not upload the image.'));
  return response.json() as Promise<SerializedMedia>;
}

export async function updateLibraryAlt(
  id: string,
  siteId: string,
  alt: string,
): Promise<SerializedMedia> {
  const response = await fetch(`/api/admin/media/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-cms-site': siteId },
    body: JSON.stringify({ alt }),
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not update alt text.'));
  return response.json() as Promise<SerializedMedia>;
}

export async function deleteLibraryImage(id: string, siteId: string): Promise<void> {
  const response = await fetch(`/api/admin/media/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-cms-site': siteId },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(
      typeof payload?.error === 'string' ? payload.error : 'Could not delete the image.',
    ) as Error & { references?: { type: string; title: string }[]; code?: string };
    error.references = payload?.details?.references;
    error.code = payload?.code;
    throw error;
  }
}
