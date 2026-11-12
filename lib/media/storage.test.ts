import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HttpError } from '@/lib/http/errors';
import { buildOriginalKey } from '@/lib/media/keys';
import { LocalDiskStorage } from '@/lib/media/storage';

describe('local disk media storage', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function storage() {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cms-media-'));
    dirs.push(root);
    return new LocalDiskStorage(root);
  }

  it('round-trips a finalized key and builds a first-party public URL', async () => {
    const disk = await storage();
    const key = buildOriginalKey(
      'demo',
      'image/png',
      new Date('2026-11-12T00:00:00Z'),
      'b'.repeat(32),
    );
    const body = Buffer.from('hello-image');
    await disk.put(key, body, 'image/png');
    expect(await disk.get(key)).toEqual(body);
    expect(disk.publicUrl(key)).toBe(`http://localhost:3003/media/${key}`);
    await disk.delete(key);
    expect(await disk.get(key)).toBeNull();
  });

  it('refuses to read or write a key that is not a finalized library object', async () => {
    const disk = await storage();
    await expect(disk.put('staging/abc/def', Buffer.from('x'), 'image/png')).rejects.toBeInstanceOf(
      HttpError,
    );
    await expect(disk.get('../package.json')).rejects.toBeInstanceOf(HttpError);
    await expect(
      disk.get('sites/demo/2026-11-12/' + 'c'.repeat(32) + '.svg'),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
