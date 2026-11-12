import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { resolveImageMime, sniffImageMime } from '@/lib/media/magic';
import { HttpError } from '@/lib/http/errors';

async function image(format: 'jpeg' | 'png' | 'webp' | 'gif' | 'avif', width = 16, height = 16) {
  const base = sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  });
  if (format === 'jpeg') return base.jpeg().toBuffer();
  if (format === 'png') return base.png().toBuffer();
  if (format === 'webp') return base.webp().toBuffer();
  if (format === 'gif') return base.gif().toBuffer();
  return base.avif().toBuffer();
}

describe('image magic-byte sniffing', () => {
  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['gif', 'image/gif'],
    ['avif', 'image/avif'],
  ] as const)('sniffs a real %s', async (format, mime) => {
    const bytes = await image(format);
    expect(sniffImageMime(bytes)).toBe(mime);
    expect(resolveImageMime(bytes, mime)).toBe(mime);
    expect(resolveImageMime(bytes)).toBe(mime);
  });

  it('rejects a declared type that does not match the bytes', async () => {
    const png = await image('png');
    try {
      resolveImageMime(png, 'image/jpeg');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).message).toMatch(/does not match/);
    }
  });

  it('rejects random bytes and a truncated header', () => {
    expect(sniffImageMime(Buffer.from('not an image at all!!'))).toBeNull();
    expect(sniffImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(() => resolveImageMime(Buffer.from('hello world'))).toThrow(HttpError);
  });

  it('does not treat an SVG or a PDF as an image', () => {
    const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const pdf = Buffer.from('%PDF-1.4\n%âãÏÓ\n');
    expect(sniffImageMime(svg)).toBeNull();
    expect(sniffImageMime(pdf)).toBeNull();
  });
});
