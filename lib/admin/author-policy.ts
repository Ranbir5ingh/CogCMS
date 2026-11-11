import { HttpError } from '@/lib/http/errors';
import Blog from '@/models/Blog';

/* Deletion is irreversible, so any blog referencing the author blocks it — a draft
   post would otherwise be left with a dangling authorId. Unpublishing only needs to
   protect published blogs, since a draft has no public byline to break. */
export async function assertAuthorNotUsedByBlogs(
  siteId: string,
  authorId: string,
  scope: 'published' | 'any',
): Promise<void> {
  const blogCount = await Blog.countDocuments(
    scope === 'published' ? { siteId, authorId, status: 'publish' } : { siteId, authorId },
  );
  if (blogCount === 0) return;

  throw new HttpError(
    409,
    'CONFLICT',
    scope === 'published'
      ? 'Author is assigned to published blogs. Reassign or unpublish them first.'
      : 'Author is assigned to blogs. Reassign those blogs before deleting this author.',
    { blogCount },
  );
}
