import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { LocalDiskStorage } from '@/lib/media/storage';
import { planVariants, storeVariants, VARIANT_MAX } from '@/lib/media/variants';

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 40, b: 40 } },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function gif(pages: number): Promise<Buffer> {
  const pixels = Buffer.alloc(pages * 3 * 8 * 8);
  return sharp(pixels, { raw: { width: 8, height: 8 * pages, channels: 3, pageHeight: 8 } })
    .gif({ keepDuplicateFrames: true, delay: Array(pages).fill(10) })
    .toBuffer();
}

describe('image size variants', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('does not upscale a small image and shares one WebP across the derivative sizes', async () => {
    const bytes = await jpeg(200, 120);
    const planned = await planVariants(bytes, 'image/jpeg');
    expect(planned.width).toBe(200);
    expect(planned.height).toBe(120);
    expect(planned.generated.map((item) => item.name)).toEqual(['original', 'thumbnail']);
    const thumb = planned.generated[1];
    expect(thumb.width).toBe(200);
    expect(thumb.height).toBe(120);
    expect(thumb.mimeType).toBe('image/webp');

    const root = await mkdtemp(path.join(os.tmpdir(), 'cms-media-'));
    dirs.push(root);
    const storage = new LocalDiskStorage(root);
    const stored = await storeVariants(storage, 'demo', 'image/jpeg', bytes);
    expect(stored.sizes.thumbnail.key).toContain('-thumbnail.webp');
    expect(stored.sizes.medium.key).toBe(stored.sizes.thumbnail.key);
    expect(stored.sizes.large.key).toBe(stored.sizes.thumbnail.key);
    expect(stored.writtenKeys).toHaveLength(2);
  });

  it('writes a thumbnail and a same-dimension medium for a mid-size image; large aliases medium', async () => {
    const bytes = await jpeg(400, 300);
    const planned = await planVariants(bytes, 'image/jpeg');
    expect(planned.generated.map((item) => item.name)).toEqual(['original', 'thumbnail', 'medium']);
    const thumb = planned.generated.find((item) => item.name === 'thumbnail')!;
    const medium = planned.generated.find((item) => item.name === 'medium')!;
    expect(Math.max(thumb.width, thumb.height)).toBe(VARIANT_MAX.thumbnail);
    expect(medium.width).toBe(400);
    expect(medium.height).toBe(300);
    expect(medium.mimeType).toBe('image/webp');

    const root = await mkdtemp(path.join(os.tmpdir(), 'cms-media-'));
    dirs.push(root);
    const stored = await storeVariants(new LocalDiskStorage(root), 'demo', 'image/jpeg', bytes);
    expect(stored.sizes.thumbnail.key).toContain('-thumbnail.webp');
    expect(stored.sizes.medium.key).toContain('-medium.webp');
    expect(stored.sizes.large.key).toBe(stored.sizes.medium.key);
    expect(stored.writtenKeys).toHaveLength(3);
  });

  it('generates every derivative for a large image without upscaling', async () => {
    const bytes = await jpeg(2400, 1200);
    const planned = await planVariants(bytes, 'image/jpeg');
    expect(planned.generated.map((item) => item.name)).toEqual([
      'original',
      'thumbnail',
      'medium',
      'large',
    ]);
    for (const name of ['thumbnail', 'medium', 'large'] as const) {
      const variant = planned.generated.find((item) => item.name === name)!;
      expect(Math.max(variant.width, variant.height)).toBe(VARIANT_MAX[name]);
      expect(variant.mimeType).toBe('image/webp');
    }
    const webp = sharp(planned.generated.find((item) => item.name === 'large')!.bytes);
    expect((await webp.metadata()).format).toBe('webp');
  });

  it('keeps an animated original and derives first-frame WebP variants', async () => {
    const bytes = await gif(4);
    const planned = await planVariants(bytes, 'image/gif');
    const originalMeta = await sharp(planned.generated[0].bytes, { animated: true }).metadata();
    expect(originalMeta.pages ?? 1).toBeGreaterThan(1);
    // 8px GIF still gets one first-frame WebP; the larger sizes alias it.
    expect(planned.generated.map((item) => item.name)).toEqual(['original', 'thumbnail']);
    expect(planned.generated[1].mimeType).toBe('image/webp');
    expect(planned.generated[1].width).toBe(8);

    const large = await sharp({
      create: { width: 900, height: 600, channels: 3, background: 'green' },
    })
      .gif()
      .toBuffer();
    const largePlan = await planVariants(large, 'image/gif');
    const thumb = largePlan.generated.find((item) => item.name === 'thumbnail');
    expect(thumb).toBeDefined();
    const thumbMeta = await sharp(thumb!.bytes, { animated: true }).metadata();
    expect(thumbMeta.format).toBe('webp');
    expect(thumbMeta.pages ?? 1).toBe(1);
  });
});
