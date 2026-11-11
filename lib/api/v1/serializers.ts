import type { IAuthor } from '@/models/Author';
import type { IBlog } from '@/models/Blog';
import type { IFAQ } from '@/models/FAQ';
import type { IReleaseNote } from '@/models/ReleaseNote';
import type { ISite } from '@/models/Site';
import type { IWhitepaper } from '@/models/Whitepaper';
import { contentToBlocks } from '@/lib/whitepaper-content';
import { safeMediaPrefix } from '@/lib/aws-s3';

export const keywordList = (value?: string) => [
  ...new Set(
    (value ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  ),
];

export function serializePublicSite(site: ISite) {
  const publicOrigin = process.env.S3_PUBLIC_URL?.trim().replace(/\/+$/, '');
  return {
    id: site._id.toString(),
    slug: site.slug,
    name: site.name,
    primaryDomain: site.primaryDomain,
    publicPaths: {
      blogs: site.publicPaths.blogs,
      whitepapers: site.publicPaths.whitepapers,
      faq: site.publicPaths.faq,
      releaseNotes: site.publicPaths.releaseNotes,
    },
    publisher: {
      name: site.publisher.name,
      url: site.publisher.url,
      logoUrl: site.publisher.logoUrl,
    },
    mediaBaseUrl: publicOrigin
      ? `${publicOrigin}/sites/${safeMediaPrefix(site.mediaPrefix)}`
      : null,
    updatedAt: site.updatedAt.toISOString(),
  };
}

export function serializeAuthor(author: IAuthor) {
  return {
    id: author._id.toString(),
    name: author.name,
    slug: author.slug,
    role: author.role ?? '',
    bio: author.bio ?? '',
    avatarUrl: author.avatarUrl ?? '',
    socials: {
      x: author.socials?.x ?? '',
      linkedin: author.socials?.linkedin ?? '',
      website: author.socials?.website ?? '',
    },
  };
}

export function serializeFaq(faq: IFAQ) {
  return {
    id: faq._id.toString(),
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    order: faq.order,
  };
}

export function serializeWhitepaperSummary(paper: IWhitepaper) {
  return {
    id: paper._id.toString(),
    title: paper.title,
    slug: paper.slug,
    description: paper.description,
    date: paper.date,
    author: paper.author,
    authorRole: paper.authorRole,
    readTime: paper.readTime,
    tags: [...paper.tags],
    headline: paper.headline,
    stat1Value: paper.stat1Value,
    stat1Label: paper.stat1Label,
    stat2Value: paper.stat2Value,
    stat2Label: paper.stat2Label,
    excerpt: paper.excerpt,
    imageUrl: paper.imageUrl,
    tag: paper.tag ?? '',
    isFeatured: paper.isFeatured,
    publishedAt: paper.publishedAt?.toISOString() ?? null,
    updatedAt: paper.updatedAt.toISOString(),
  };
}

export function serializeWhitepaper(paper: IWhitepaper) {
  return {
    ...serializeWhitepaperSummary(paper),
    content: paper.content,
    blocks: contentToBlocks(paper.content),
    metaTitle: paper.metaTitle ?? '',
    metaDescription: paper.metaDescription ?? '',
    keywords: keywordList(paper.keywords),
  };
}

export function releaseDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function serializeReleaseNote(note: IReleaseNote) {
  return {
    id: note._id.toString(),
    slug: note.slug,
    version: note.version,
    releaseDate: note.releaseDate.toISOString(),
    dateLabel: releaseDateLabel(note.releaseDate),
    intro: [...note.intro],
    sections: note.sections.map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({ type: item.type, text: item.text })),
    })),
  };
}

export function serializePostSummary(
  blog: IBlog,
  author?: ReturnType<typeof serializeAuthor> | null,
) {
  return {
    id: blog._id.toString(),
    title: blog.title,
    slug: blog.slug,
    excerpt: blog.excerpt || blog.metaDescription || '',
    imageUrl: blog.imageUrl,
    imageAlt: blog.imageAlt ?? '',
    tag: blog.tag ?? '',
    category: blog.category ?? '',
    tags: [...blog.tags],
    isFeatured: blog.isFeatured,
    publishedAt: blog.publishedAt?.toISOString() ?? null,
    updatedAt: blog.updatedAt.toISOString(),
    ...(author !== undefined ? { author } : {}),
  };
}

export function serializePostCard(blog: IBlog) {
  return serializePostSummary(blog);
}
