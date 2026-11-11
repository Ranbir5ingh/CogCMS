import { describe, expect, it } from 'vitest';
import { isSentinelEntry, leaveTargetFor, type LinkClick } from './use-leave-guard';

const here = 'https://cms.example.com/admin/dashboard/blogs/new?slug=post';

function click(overrides: Partial<LinkClick> = {}): LinkClick {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    target: '',
    hasDownload: false,
    href: 'https://cms.example.com/admin/dashboard/blogs',
    ...overrides,
  };
}

describe('leaveTargetFor', () => {
  it('guards a plain in-app link and returns its path', () => {
    expect(leaveTargetFor(click(), here)).toBe('/admin/dashboard/blogs');
    expect(
      leaveTargetFor(click({ href: 'https://cms.example.com/admin/dashboard/faqs?x=1#top' }), here),
    ).toBe('/admin/dashboard/faqs?x=1#top');
  });

  it('lets modified and non-primary clicks through', () => {
    for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      expect(leaveTargetFor(click({ [key]: true }), here)).toBeNull();
    }
    expect(leaveTargetFor(click({ button: 1 }), here)).toBeNull();
    expect(leaveTargetFor(click({ defaultPrevented: true }), here)).toBeNull();
  });

  it('lets new-tab, download and external links through', () => {
    expect(leaveTargetFor(click({ target: '_blank' }), here)).toBeNull();
    expect(leaveTargetFor(click({ hasDownload: true }), here)).toBeNull();
    expect(leaveTargetFor(click({ href: 'https://www.example.com/blogs' }), here)).toBeNull();
  });

  it('lets same-page hash links through', () => {
    expect(
      leaveTargetFor(
        click({ href: 'https://cms.example.com/admin/dashboard/blogs/new?slug=post#faq' }),
        here,
      ),
    ).toBeNull();
  });

  it('treats target="_self" as a normal link', () => {
    expect(leaveTargetFor(click({ target: '_self' }), here)).toBe('/admin/dashboard/blogs');
  });
});

describe('isSentinelEntry', () => {
  const href = 'https://cms.example.com/admin/dashboard/faqs/new';

  it('recognises the sentinel entry after a reload', () => {
    expect(isSentinelEntry({ href, length: 3 }, href, 3)).toBe(true);
  });

  it('does not match a different page or history position', () => {
    expect(isSentinelEntry({ href, length: 3 }, `${href}?id=1`, 3)).toBe(false);
    expect(isSentinelEntry({ href, length: 3 }, href, 5)).toBe(false);
    expect(isSentinelEntry(null, href, 3)).toBe(false);
  });
});
