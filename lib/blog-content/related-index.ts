import Blog, { type IBlog } from '@/models/Blog';
import { selectRelated, type BlogLike } from '@/lib/blog-content/related';

type Loader<T extends BlogLike> = (siteId: string) => Promise<T[]>;
type Cached<T extends BlogLike> = { rows: T[]; expiresAt: number };

export class RelatedPostIndex<T extends BlogLike = BlogLike> {
  private readonly cache = new Map<string, Cached<T>>();

  constructor(
    private readonly loader: Loader<T>,
    private readonly ttlMs = 60_000,
  ) {}

  async related(siteId: string, current: T, limit = 3, now = Date.now()): Promise<T[]> {
    let cached = this.cache.get(siteId);
    if (!cached || cached.expiresAt <= now) {
      cached = { rows: await this.loader(siteId), expiresAt: now + this.ttlMs };
      this.cache.set(siteId, cached);
    }
    return selectRelated(current, cached.rows, limit) as T[];
  }

  invalidate(siteId: string): void {
    this.cache.delete(siteId);
  }

  clear(): void {
    this.cache.clear();
  }
}

const relatedPostIndex = new RelatedPostIndex<IBlog>(async (siteId) =>
  Blog.find({ siteId, status: 'publish' })
    .select({
      title: 1,
      slug: 1,
      excerpt: 1,
      metaDescription: 1,
      imageUrl: 1,
      imageAlt: 1,
      tag: 1,
      category: 1,
      tags: 1,
      isFeatured: 1,
      publishedAt: 1,
      relatedSlugs: 1,
      createdAt: 1,
      updatedAt: 1,
      status: 1,
    })
    .exec(),
);

export function getRelatedPosts(siteId: string, current: IBlog, limit = 3): Promise<IBlog[]> {
  return relatedPostIndex.related(siteId, current, limit);
}

export function invalidateRelatedPosts(siteId: string): void {
  relatedPostIndex.invalidate(siteId);
}

export function clearRelatedPostIndex(): void {
  relatedPostIndex.clear();
}
