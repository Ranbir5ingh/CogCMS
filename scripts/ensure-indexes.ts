import mongoose, { type Model } from 'mongoose';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import connectToDatabase from '@/lib/mongodb';
import Author from '@/models/Author';
import ApiKey from '@/models/ApiKey';
import Blog from '@/models/Blog';
import Event from '@/models/Event';
import LoginAttempt from '@/models/LoginAttempt';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';
import ReleaseNote from '@/models/ReleaseNote';
import Site from '@/models/Site';
import User from '@/models/User';
import Whitepaper from '@/models/Whitepaper';
import { modelRegistry } from '@/scripts/model-registry';

type UniqueCheck = { model: Model<any>; fields: string[] };

const uniqueChecks: UniqueCheck[] = [
  { model: Site, fields: ['slug'] },
  { model: User, fields: ['email'] },
  { model: LoginAttempt, fields: ['key'] },
  { model: Blog, fields: ['siteId', 'slug'] },
  { model: Event, fields: ['siteId', 'slug'] },
  { model: Author, fields: ['siteId', 'slug'] },
  { model: Whitepaper, fields: ['siteId', 'slug'] },
  { model: NewsletterSubscriber, fields: ['siteId', 'email'] },
  { model: ReleaseNote, fields: ['siteId', 'slug'] },
  { model: ApiKey, fields: ['prefix'] },
];

function printable(value: unknown): string {
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value && typeof value === 'object') {
    return JSON.stringify(value, (_key, nested) =>
      nested instanceof mongoose.Types.ObjectId ? nested.toString() : nested,
    );
  }
  return String(value);
}

async function duplicateKeys({ model, fields }: UniqueCheck): Promise<string[]> {
  const groupedId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  const rows = await model.collection
    .aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: groupedId, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();
  return rows.map(
    (row) => `${model.collection.collectionName} ${printable(row._id)} (${row.count})`,
  );
}

export async function ensureIndexes(): Promise<void> {
  await connectToDatabase();
  const duplicates = (await Promise.all(uniqueChecks.map(duplicateKeys))).flat();
  if (duplicates.length > 0) {
    throw new Error(`Duplicate keys block index creation:\n${duplicates.join('\n')}`);
  }
  for (const model of modelRegistry) await model.createIndexes();
}

async function main(): Promise<void> {
  try {
    await ensureIndexes();
    console.log(`Ensured indexes for ${modelRegistry.length} models.`);
  } finally {
    await mongoose.disconnect();
  }
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entry === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
