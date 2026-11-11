import { beforeAll, describe, expect, it } from 'vitest';
import { POST as createAuthor } from '@/app/api/admin/authors/route';
import { POST as createWhitepaper } from '@/app/api/admin/whitepapers/route';
import { POST as createNote } from '@/app/api/admin/release-notes/route';
import Author from '@/models/Author';
import ReleaseNote from '@/models/ReleaseNote';
import Whitepaper from '@/models/Whitepaper';
import { authenticatedRequest, createTestSite, createTestUser } from '@/tests/setup/factories';

const rootContext = { params: Promise.resolve({}) };

const cases = [
  {
    name: 'authors',
    handler: createAuthor,
    model: Author,
    payload: () => ({ name: 'Shared Author', slug: 'shared' }),
  },
  {
    name: 'whitepapers',
    handler: createWhitepaper,
    model: Whitepaper,
    payload: () => ({ title: 'Shared', slug: 'shared', description: 'Desc', content: 'Body' }),
  },
] as const;

describe('slug uniqueness is scoped per site', () => {
  beforeAll(async () => {
    await Promise.all([
      Author.createIndexes(),
      Whitepaper.createIndexes(),
      ReleaseNote.createIndexes(),
    ]);
  });

  for (const { name, handler, model, payload } of cases) {
    it(`${name}: same slug is allowed across sites and rejected within one site`, async () => {
      const admin = await createTestUser();
      const [siteA, siteB] = await Promise.all([createTestSite(), createTestSite()]);
      const create = async (siteId: string) =>
        handler(
          await authenticatedRequest(`http://localhost:3003/api/admin/${name}`, {
            user: admin,
            siteId,
            method: 'POST',
            json: payload(),
          }),
          rootContext,
        );

      expect((await create(siteA._id.toString())).status).toBe(201);
      expect((await create(siteB._id.toString())).status).toBe(201);

      const duplicate = await create(siteA._id.toString());
      expect(duplicate.status).toBe(409);
      expect((await duplicate.json()).code).toBe('DUPLICATE_SLUG');

      expect(await (model as typeof Author).countDocuments({ siteId: siteA._id })).toBe(1);
      expect(await (model as typeof Author).countDocuments({ siteId: siteB._id })).toBe(1);
    });
  }

  it('release-notes: a repeated version on one site gets a suffixed slug instead of colliding', async () => {
    const admin = await createTestUser();
    const [siteA, siteB] = await Promise.all([createTestSite(), createTestSite()]);
    const create = async (siteId: string) =>
      (
        await createNote(
          await authenticatedRequest('http://localhost:3003/api/admin/release-notes', {
            user: admin,
            siteId,
            method: 'POST',
            json: { version: '7.0', date: '2026-09-22', bodyMarkdown: 'Body', status: 'draft' },
          }),
          rootContext,
        )
      ).json();

    expect((await create(siteA._id.toString())).slug).toBe('v7-0');
    expect((await create(siteB._id.toString())).slug).toBe('v7-0');
    expect((await create(siteA._id.toString())).slug).toBe('v7-0-2');
    expect(await ReleaseNote.countDocuments({ siteId: siteA._id })).toBe(2);
    expect(await ReleaseNote.countDocuments({ siteId: siteB._id })).toBe(1);
  });
});
