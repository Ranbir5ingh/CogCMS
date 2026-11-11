import { randomBytes } from 'node:crypto';
import { mongo } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { publishedViews, provisionPublishedViews, readerPrivileges } from './views';

const siteA = new mongo.ObjectId();
const siteB = new mongo.ObjectId();
let server: MongoMemoryServer;
let operator: mongo.MongoClient;
let db: mongo.Db;

beforeAll(async () => {
  const password = randomBytes(24).toString('hex');
  server = await MongoMemoryServer.create({
    auth: { enable: true, customRootName: 'test_operator', customRootPwd: password },
  });
  operator = await new mongo.MongoClient(server.getUri(), {
    auth: { username: 'test_operator', password },
    authSource: 'admin',
    monitorCommands: true,
  }).connect();
}, 60_000);

beforeEach(async () => {
  db = operator.db(`views_${randomBytes(8).toString('hex')}`);
  await db.collection('sites').insertMany([
    {
      _id: siteA,
      name: 'A',
      slug: 'a',
      status: 'active',
      webhookSecret: 'hidden-sentinel',
      publisher: { name: 'A', hidden: 'hidden-sentinel' },
    },
    { _id: siteB, name: 'B', slug: 'b', status: 'active' },
  ]);
});

afterAll(async () => {
  await operator?.close();
  await server?.stop();
});

describe('published Mongo view boundary', () => {
  it('reads full namespace metadata without Atlas-unsupported name filters', async () => {
    await db.createCollection('unrelated_view', { viewOn: 'blogs', pipeline: [] });
    const commands: mongo.Document[] = [];
    const capture = (event: mongo.CommandStartedEvent) => {
      if (event.databaseName === db.databaseName && event.commandName === 'listCollections') {
        commands.push(event.command);
      }
    };
    operator.on('commandStarted', capture);
    try {
      const plan = await provisionPublishedViews(db, siteA.toHexString());
      expect(plan).toHaveLength(7);
      expect(plan.every((view) => view.action === 'create')).toBe(true);
      expect(commands).toHaveLength(1);
      expect(commands[0].filter).toEqual({});
      expect(commands[0].nameOnly).toBe(false);
    } finally {
      operator.off('commandStarted', capture);
    }
    expect(await db.listCollections({ type: 'view' }).toArray()).toHaveLength(1);
  });

  it('retains FAQ creation dates for the public API ordering tie-break', async () => {
    const createdAt = new Date('2026-01-02T00:00:00Z');
    await db.collection('faqs').insertOne({
      siteId: siteA,
      status: 'publish',
      question: 'Q',
      answer: 'A',
      order: 1,
      createdAt,
    });
    await provisionPublishedViews(db, siteA.toHexString(), { write: true });
    expect((await db.collection(`cms_v1_${siteA}_faqs`).findOne({}))?.createdAt).toEqual(createdAt);
  });

  it('validates immutable site names and pins all real source collections', () => {
    for (const bad of ['', 'not-an-id', `${siteA}.users`, 'a'.repeat(23)]) {
      expect(() => publishedViews(bad)).toThrow();
    }
    expect(publishedViews(siteA.toHexString().toUpperCase()).map((v) => v.name)).toEqual(
      ['events', 'site', 'posts', 'authors', 'faqs', 'whitepapers', 'release_notes'].map(
        (k) => `cms_v1_${siteA}_${k}`,
      ),
    );
    expect(publishedViews(siteA.toHexString()).map((v) => v.viewOn)).toEqual([
      'events',
      'sites',
      'blogs',
      'authors',
      'faqs',
      'whitepapers',
      'release_notes',
    ]);
  });

  it('defaults to dry run and provisions identical views idempotently', async () => {
    const plan = await provisionPublishedViews(db, siteA.toHexString());
    expect(plan).toHaveLength(7);
    expect(await db.listCollections({ type: 'view' }).toArray()).toHaveLength(0);
    await provisionPublishedViews(db, siteA.toHexString(), { write: true });
    expect(
      (await provisionPublishedViews(db, siteA.toHexString(), { write: true })).every(
        (v) => v.action === 'unchanged',
      ),
    ).toBe(true);
  });

  it('preflights every namespace before creating any and refuses collisions', async () => {
    const last = `cms_v1_${siteA}_release_notes`;
    await db.createCollection(last);
    await expect(provisionPublishedViews(db, siteA.toHexString(), { write: true })).rejects.toThrow(
      /collision/i,
    );
    expect(await db.listCollections({ type: 'view' }).toArray()).toHaveLength(0);
  });

  it('refuses missing sites and incompatible existing view definitions', async () => {
    await expect(
      provisionPublishedViews(db, new mongo.ObjectId().toHexString(), { write: true }),
    ).rejects.toThrow(/site/i);
    await db.createCollection(`cms_v1_${siteA}_posts`, { viewOn: 'blogs', pipeline: [] });
    await expect(provisionPublishedViews(db, siteA.toHexString(), { write: true })).rejects.toThrow(
      /collision/i,
    );
    expect(await db.listCollections({ type: 'view' }).toArray()).toHaveLength(1);
  });

  it('excludes drafts, other sites and unlisted nested fields for every content kind', async () => {
    for (const collection of [
      'events',
      'blogs',
      'authors',
      'faqs',
      'whitepapers',
      'release_notes',
    ]) {
      await db.collection(collection).insertMany([
        {
          siteId: siteA,
          slug: 'same',
          status: 'publish',
          title: 'A',
          createdBy: 'hidden-sentinel',
          secret: 'hidden-sentinel',
          rendered: {
            html: '<p>A</p>',
            secret: 'hidden-sentinel',
            toc: [{ id: 'a', text: 'A', level: 2, secret: 'hidden-sentinel' }],
          },
          faqs: [{ question: 'Q', answer: 'A', secret: 'hidden-sentinel' }],
        },
        { siteId: siteA, slug: 'draft', status: 'draft' },
        { siteId: siteB, slug: 'same', status: 'publish' },
        { siteId: siteA, slug: 'unknown' },
      ]);
    }
    await provisionPublishedViews(db, siteA.toHexString(), { write: true });
    for (const view of publishedViews(siteA.toHexString())) {
      const rows = await db.collection(view.name).find({}).toArray();
      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows)).not.toContain('hidden-sentinel');
    }
    const post = await db.collection(`cms_v1_${siteA}_posts`).findOne({ slug: 'same' });
    expect(post?.rendered.html).toBe('<p>A</p>');
    await db.collection('sites').updateOne({ _id: siteA }, { $set: { status: 'archived' } });
    for (const view of publishedViews(siteA.toHexString())) {
      expect(await db.collection(view.name).countDocuments()).toBe(0);
    }
  });

  it('enforces view-only read access in Mongo itself, including lookup source isolation', async () => {
    await db
      .collection('blogs')
      .insertOne({ siteId: siteA, slug: 'published', status: 'publish', title: 'Allowed' });
    await provisionPublishedViews(db, siteA.toHexString(), { write: true });
    await provisionPublishedViews(db, siteB.toHexString(), { write: true });
    await db.command({
      createRole: 'site_reader',
      privileges: readerPrivileges(db.databaseName, siteA.toHexString()),
      roles: [],
    });
    const password = randomBytes(24).toString('hex');
    await db.command({
      createUser: 'reader',
      pwd: password,
      roles: [{ role: 'site_reader', db: db.databaseName }],
    });
    const reader = await new mongo.MongoClient(server.getUri(), {
      auth: { username: 'reader', password },
      authSource: db.databaseName,
    }).connect();
    try {
      const readDb = reader.db(db.databaseName);
      const own = readDb.collection(`cms_v1_${siteA}_posts`);
      expect((await own.find({}).toArray()).map((p) => p.title)).toEqual(['Allowed']);
      for (const name of [
        'blogs',
        'sites',
        'users',
        'api_keys',
        'faq_submissions',
        'newsletter_subscribers',
        `cms_v1_${siteB}_posts`,
      ]) {
        await expect(readDb.collection(name).find({}).toArray()).rejects.toMatchObject({
          code: 13,
        });
      }
      await expect(own.insertOne({ title: 'No' })).rejects.toMatchObject({ code: 13 });
      await expect(
        readDb.command({ collMod: own.collectionName, viewOn: 'blogs', pipeline: [] }),
      ).rejects.toMatchObject({ code: 13 });
      await expect(readDb.command({ drop: own.collectionName })).rejects.toMatchObject({
        code: 13,
      });
    } finally {
      await reader.close();
    }
  });

  it('rejects array-valued tenant and publication fields even when an array element matches', async () => {
    await db.collection('blogs').insertMany([
      { siteId: [siteA, siteB], status: 'publish', title: 'mixed sites' },
      { siteId: siteA, status: ['draft', 'publish'], title: 'mixed status' },
      { siteId: siteA, status: 'PUBLISH', title: 'wrong case' },
    ]);
    await provisionPublishedViews(db, siteA.toHexString(), { write: true });
    const posts = db.collection(`cms_v1_${siteA}_posts`);
    expect(await posts.find({}).toArray()).toEqual([]);
    await db.collection('sites').deleteOne({ _id: siteA });
    expect(await posts.find({}).toArray()).toEqual([]);
    await db.collection('sites').insertOne({ _id: siteA, status: ['archived', 'active'] });
    await db
      .collection('blogs')
      .insertOne({ siteId: siteA, status: 'publish', title: 'inactive site' });
    for (const view of publishedViews(siteA.toHexString())) {
      expect(await db.collection(view.name).find({}).toArray()).toEqual([]);
    }
  });
});
