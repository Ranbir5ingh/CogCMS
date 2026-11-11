import { mongo } from 'mongoose';
import { isDeepStrictEqual } from 'node:util';

export type PublishedView = { name: string; viewOn: string; pipeline: mongo.Document[] };

function siteObjectId(value: string): mongo.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new Error('A canonical site ObjectId is required.');
  return new mongo.ObjectId(value);
}

function projection(fields: string[]): Record<string, 1> {
  return Object.fromEntries(['_id', ...fields].map((field) => [field, 1]));
}

// Public BSON contract: add fields deliberately; never project an entire nested object.
const definitions = [
  {
    kind: 'events',
    source: 'events',
    fields: [
      'title',
      'slug',
      'summary',
      'content',
      'imageUrl',
      'imageAlt',
      'startAt',
      'endAt',
      'timeZone',
      'format',
      'location',
      'onlineUrl',
      'registrationUrl',
      'organizer',
      'speakers',
      'metaTitle',
      'metaDescription',
      'updatedAt',
    ],
  },
  {
    kind: 'site',
    source: 'sites',
    fields: [
      'name',
      'slug',
      'primaryDomain',
      'publicPaths.blogs',
      'publicPaths.whitepapers',
      'publicPaths.faq',
      'publicPaths.releaseNotes',
      'publisher.name',
      'publisher.url',
      'publisher.logoUrl',
      'defaultLocale',
      'mediaPrefix',
      'updatedAt',
    ],
  },
  {
    kind: 'posts',
    source: 'blogs',
    fields: [
      'title',
      'slug',
      'excerpt',
      'imageUrl',
      'tag',
      'authorId',
      'category',
      'tags',
      'faqs.question',
      'faqs.answer',
      'keyTakeaways',
      'relatedSlugs',
      'tocOverrides.id',
      'tocOverrides.label',
      'tocOverrides.hidden',
      'publishedAt',
      'createdAt',
      'updatedAt',
      'metaTitle',
      'metaDescription',
      'keywords',
      'isFeatured',
      'rendered.html',
      'rendered.toc.id',
      'rendered.toc.text',
      'rendered.toc.level',
      'rendered.wordCount',
      'rendered.readingTime',
      'rendered.pipelineVersion',
      'rendered.renderedAt',
    ],
  },
  {
    kind: 'authors',
    source: 'authors',
    fields: [
      'name',
      'slug',
      'role',
      'bio',
      'avatarUrl',
      'socials.x',
      'socials.linkedin',
      'socials.website',
      'updatedAt',
    ],
  },
  {
    kind: 'faqs',
    source: 'faqs',
    fields: ['question', 'answer', 'category', 'order', 'createdAt', 'updatedAt'],
  },
  {
    kind: 'whitepapers',
    source: 'whitepapers',
    fields: [
      'title',
      'slug',
      'description',
      'date',
      'author',
      'authorRole',
      'readTime',
      'tags',
      'headline',
      'stat1Value',
      'stat1Label',
      'stat2Value',
      'stat2Label',
      'excerpt',
      'content',
      'imageUrl',
      'tag',
      'publishedAt',
      'metaTitle',
      'metaDescription',
      'keywords',
      'isFeatured',
      'updatedAt',
    ],
  },
  {
    kind: 'release_notes',
    source: 'release_notes',
    fields: [
      'slug',
      'version',
      'releaseDate',
      'intro',
      'sections.title',
      'sections.items.type',
      'sections.items.text',
      'updatedAt',
    ],
  },
] as const;

export function publishedViews(siteId: string): PublishedView[] {
  const id = siteObjectId(siteId);
  return definitions.map((definition) => ({
    name: `cms_v1_${id.toHexString()}_${definition.kind}`,
    viewOn: definition.source,
    pipeline: [
      ...(definition.kind === 'site'
        ? [{ $match: { _id: id, status: 'active', $expr: { $eq: ['$status', 'active'] } } }]
        : [
            // Query equality also matches array elements. $expr enforces scalar identity/status.
            {
              $match: {
                siteId: id,
                status: 'publish',
                $expr: { $and: [{ $eq: ['$siteId', id] }, { $eq: ['$status', 'publish'] }] },
              },
            },
            {
              $lookup: {
                from: 'sites',
                localField: 'siteId',
                foreignField: '_id',
                pipeline: [
                  { $match: { _id: id, status: 'active', $expr: { $eq: ['$status', 'active'] } } },
                  { $project: { _id: 1 } },
                ],
                as: '__cmsSite',
              },
            },
            { $match: { '__cmsSite.0': { $exists: true } } },
          ]),
      { $project: projection([...definition.fields]) },
    ],
  }));
}

export function readerPrivileges(database: string, siteId: string) {
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(database)) throw new Error('Invalid CMS database name.');
  return publishedViews(siteId).map((view) => ({
    resource: { db: database, collection: view.name },
    actions: ['find'],
  }));
}

export async function provisionPublishedViews(
  db: mongo.Db,
  siteId: string,
  options: { write?: boolean } = {},
): Promise<{ name: string; action: 'create' | 'unchanged' }[]> {
  const views = publishedViews(siteId);
  const site = await db
    .collection('sites')
    .findOne({ _id: siteObjectId(siteId) }, { projection: { _id: 1 } });
  if (!site) throw new Error('Site does not exist; no views were changed.');

  // Atlas shared tiers reject $in name filters; retain full metadata for collision checks.
  const existing = await db.listCollections({}, { nameOnly: false }).toArray();
  // Inspect every namespace before writing. Do not replace collections or update view definitions.
  const plan = views.map((view) => {
    const found = existing.find((collection) => collection.name === view.name);
    if (!found) return { name: view.name, action: 'create' as const };
    if (
      found.type !== 'view' ||
      found.options?.viewOn !== view.viewOn ||
      !isDeepStrictEqual(found.options?.pipeline, view.pipeline) ||
      (found.options?.collation && found.options.collation.locale !== 'simple')
    ) {
      throw new Error(`Published view namespace collision: ${view.name}; no views were changed.`);
    }
    return { name: view.name, action: 'unchanged' as const };
  });
  if (options.write) {
    for (const [index, item] of plan.entries()) {
      if (item.action === 'create') {
        const view = views[index];
        await db.createCollection(view.name, { viewOn: view.viewOn, pipeline: view.pipeline });
      }
    }
  }
  return plan;
}
