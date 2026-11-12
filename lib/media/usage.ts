import Author from '@/models/Author';
import Blog from '@/models/Blog';
import Event from '@/models/Event';
import Whitepaper from '@/models/Whitepaper';
import Site from '@/models/Site';
import { mediaTokenFromKey } from '@/lib/media/keys';
import type { IMedia } from '@/models/Media';

export interface MediaReference {
  type: 'blog' | 'event' | 'whitepaper' | 'author' | 'site';
  id: string;
  title: string;
}

function uniqueUrls(media: IMedia): string[] {
  const urls = new Set<string>();
  for (const variant of Object.values(media.sizes)) {
    if (variant?.url) urls.add(variant.url);
    try {
      urls.add(new URL(variant.url).pathname);
    } catch {
      /* keep the raw value */
    }
  }
  return [...urls];
}

function tokenFilter(token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $regex: escaped };
}

/** Find editorial records on this site that still point at the asset or its variants. */
export async function findMediaReferences(
  siteId: string,
  media: IMedia,
): Promise<MediaReference[]> {
  const urls = uniqueUrls(media);
  const token = mediaTokenFromKey(media.sizes.original.key);
  const urlClause = { $in: urls };
  const bodyClause = token ? tokenFilter(token) : null;

  const [blogs, events, papers, authors, sites] = await Promise.all([
    Blog.find({
      siteId,
      $or: [{ imageUrl: urlClause }, ...(bodyClause ? [{ content: bodyClause }] : [])],
    })
      .select('title slug')
      .lean()
      .exec(),
    Event.find({
      siteId,
      $or: [{ imageUrl: urlClause }, ...(bodyClause ? [{ content: bodyClause }] : [])],
    })
      .select('title slug')
      .lean()
      .exec(),
    Whitepaper.find({
      siteId,
      $or: [{ imageUrl: urlClause }, ...(bodyClause ? [{ content: bodyClause }] : [])],
    })
      .select('title slug')
      .lean()
      .exec(),
    Author.find({ siteId, avatarUrl: urlClause }).select('name slug').lean().exec(),
    Site.find({
      _id: siteId,
      $or: [{ 'publisher.logoUrl': urlClause }],
    })
      .select('name slug')
      .lean()
      .exec(),
  ]);

  const refs: MediaReference[] = [];
  for (const row of blogs) {
    refs.push({
      type: 'blog',
      id: String(row._id),
      title: row.title || row.slug,
    });
  }
  for (const row of events) {
    refs.push({
      type: 'event',
      id: String(row._id),
      title: (row as { title?: string }).title || (row as { slug?: string }).slug || 'Event',
    });
  }
  for (const row of papers) {
    refs.push({
      type: 'whitepaper',
      id: String(row._id),
      title: row.title || row.slug,
    });
  }
  for (const row of authors) {
    refs.push({
      type: 'author',
      id: String(row._id),
      title: row.name || row.slug,
    });
  }
  for (const row of sites) {
    refs.push({ type: 'site', id: String(row._id), title: row.name || row.slug });
  }
  return refs;
}
