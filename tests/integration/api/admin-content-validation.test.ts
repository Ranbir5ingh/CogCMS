import { describe, expect, it } from 'vitest';
import { POST as createAuthor } from '@/app/api/admin/authors/route';
import { DELETE as deleteAuthor, PUT as updateAuthor } from '@/app/api/admin/authors/[slug]/route';
import { POST as createBlog } from '@/app/api/admin/blogs/route';
import { POST as createFaq } from '@/app/api/admin/faqs/route';
import { PUT as updateFaq } from '@/app/api/admin/faqs/[id]/route';
import { POST as createWhitepaper } from '@/app/api/admin/whitepapers/route';
import Author from '@/models/Author';
import FAQ from '@/models/FAQ';
import Whitepaper from '@/models/Whitepaper';
import { authenticatedRequest, createTestSite, createTestUser } from '@/tests/setup/factories';

const rootContext = { params: Promise.resolve({}) };

async function createPublishedBlogWithAuthor() {
  const admin = await createTestUser();
  const site = await createTestSite();
  const authorResponse = await createAuthor(
    await authenticatedRequest('http://localhost:3003/api/admin/authors', {
      user: admin,
      siteId: site._id.toString(),
      method: 'POST',
      json: { name: 'Published author', slug: 'published-author', status: 'publish' },
    }),
    rootContext,
  );
  expect(authorResponse.status).toBe(201);
  const author = await Author.findOne({ siteId: site._id, slug: 'published-author' }).exec();
  expect(author).not.toBeNull();

  const blogResponse = await createBlog(
    await authenticatedRequest('http://localhost:3003/api/admin/blogs', {
      user: admin,
      siteId: site._id.toString(),
      method: 'POST',
      json: {
        title: 'Published post',
        slug: 'published-post',
        content: '<p>Published</p>',
        status: 'publish',
        authorId: author!._id.toString(),
      },
    }),
    rootContext,
  );
  expect(blogResponse.status).toBe(201);
  return { admin, site, author: author! };
}

describe('Phase C content validation and auditing', () => {
  it('validates author slugs and records create/update actors with first publish time', async () => {
    const admin = await createTestUser();
    const site = await createTestSite();
    const request = (method: string, json: unknown) =>
      authenticatedRequest('http://localhost:3003/api/admin/authors', {
        user: admin,
        siteId: site._id.toString(),
        method,
        json,
      });

    expect(
      (await createAuthor(await request('POST', { name: 'Bad', slug: 'Not Safe' }), rootContext))
        .status,
    ).toBe(400);
    const created = await createAuthor(
      await request('POST', { name: '  Ada  ', slug: 'ada', status: 'draft' }),
      rootContext,
    );
    expect(created.status).toBe(201);
    const author = await Author.findOne({ siteId: site._id, slug: 'ada' }).exec();
    expect(author).toMatchObject({ name: 'Ada', status: 'draft' });
    expect(author?.createdBy?.toString()).toBe(admin._id.toString());
    expect(author?.updatedBy?.toString()).toBe(admin._id.toString());

    const response = await updateAuthor(
      await request('PUT', { status: 'publish', siteId: '000000000000000000000000' }),
      { params: Promise.resolve({ slug: 'ada' }) },
    );
    expect(response.status).toBe(200);
    const published = await Author.findById(author?._id).exec();
    expect(published?.publishedAt).toBeTruthy();
    expect(published?.siteId.toString()).toBe(site._id.toString());
    expect(published?.updatedBy?.toString()).toBe(admin._id.toString());
  });

  it('prevents unpublishing an author used by a published blog', async () => {
    const { admin, site, author } = await createPublishedBlogWithAuthor();
    const response = await updateAuthor(
      await authenticatedRequest(`http://localhost:3003/api/admin/authors/${author.slug}`, {
        user: admin,
        siteId: site._id.toString(),
        method: 'PUT',
        json: { status: 'draft' },
      }),
      { params: Promise.resolve({ slug: author.slug }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CONFLICT' });
    expect((await Author.findById(author._id))?.status).toBe('publish');
  });

  it('prevents deleting an author used by a published blog', async () => {
    const { admin, site, author } = await createPublishedBlogWithAuthor();
    const response = await deleteAuthor(
      await authenticatedRequest(`http://localhost:3003/api/admin/authors/${author.slug}`, {
        user: admin,
        siteId: site._id.toString(),
        method: 'DELETE',
      }),
      { params: Promise.resolve({ slug: author.slug }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CONFLICT' });
    expect(await Author.findById(author._id)).not.toBeNull();
  });

  it('prevents deleting an author used by a draft blog', async () => {
    const admin = await createTestUser();
    const site = await createTestSite();
    await createAuthor(
      await authenticatedRequest('http://localhost:3003/api/admin/authors', {
        user: admin,
        siteId: site._id.toString(),
        method: 'POST',
        json: { name: 'Draft author', slug: 'draft-author', status: 'publish' },
      }),
      rootContext,
    );
    const author = await Author.findOne({ siteId: site._id, slug: 'draft-author' }).exec();
    await createBlog(
      await authenticatedRequest('http://localhost:3003/api/admin/blogs', {
        user: admin,
        siteId: site._id.toString(),
        method: 'POST',
        json: {
          title: 'Unfinished post',
          slug: 'unfinished-post',
          content: '<p>Draft</p>',
          status: 'draft',
          authorId: author!._id.toString(),
        },
      }),
      rootContext,
    );

    const response = await deleteAuthor(
      await authenticatedRequest(`http://localhost:3003/api/admin/authors/${author!.slug}`, {
        user: admin,
        siteId: site._id.toString(),
        method: 'DELETE',
      }),
      { params: Promise.resolve({ slug: author!.slug }) },
    );

    expect(response.status).toBe(409);
    expect(await Author.findById(author!._id)).not.toBeNull();
  });

  it('still allows unpublishing an author whose only blog is a draft', async () => {
    const admin = await createTestUser();
    const site = await createTestSite();
    await createAuthor(
      await authenticatedRequest('http://localhost:3003/api/admin/authors', {
        user: admin,
        siteId: site._id.toString(),
        method: 'POST',
        json: { name: 'Quiet author', slug: 'quiet-author', status: 'publish' },
      }),
      rootContext,
    );
    const author = await Author.findOne({ siteId: site._id, slug: 'quiet-author' }).exec();
    await createBlog(
      await authenticatedRequest('http://localhost:3003/api/admin/blogs', {
        user: admin,
        siteId: site._id.toString(),
        method: 'POST',
        json: {
          title: 'Quiet draft',
          slug: 'quiet-draft',
          content: '<p>Draft</p>',
          status: 'draft',
          authorId: author!._id.toString(),
        },
      }),
      rootContext,
    );

    const response = await updateAuthor(
      await authenticatedRequest(`http://localhost:3003/api/admin/authors/${author!.slug}`, {
        user: admin,
        siteId: site._id.toString(),
        method: 'PUT',
        json: { status: 'draft' },
      }),
      { params: Promise.resolve({ slug: author!.slug }) },
    );

    expect(response.status).toBe(200);
  });

  it('rejects invalid FAQ order and audits a valid draft', async () => {
    const admin = await createTestUser();
    const site = await createTestSite();
    const request = (json: unknown) =>
      authenticatedRequest('http://localhost:3003/api/admin/faqs', {
        user: admin,
        siteId: site._id.toString(),
        method: 'POST',
        json,
      });
    expect(
      (await createFaq(await request({ question: 'Q', answer: 'A', order: -1 }), rootContext))
        .status,
    ).toBe(400);
    expect(
      (
        await createFaq(
          await request({ question: ' Q ', answer: ' A ', category: ' ', status: 'draft' }),
          rootContext,
        )
      ).status,
    ).toBe(201);
    const faq = await FAQ.findOne({ siteId: site._id }).exec();
    expect(faq).toMatchObject({ question: 'Q', answer: 'A', category: 'General', status: 'draft' });
    expect(faq?.createdBy?.toString()).toBe(admin._id.toString());

    const blankCategory = await updateFaq(
      await authenticatedRequest(`http://localhost:3003/api/admin/faqs/${faq?._id}`, {
        user: admin,
        siteId: site._id.toString(),
        method: 'PUT',
        json: { category: ' ' },
      }),
      { params: Promise.resolve({ id: faq!._id.toString() }) },
    );
    expect(blankCategory.status).toBe(400);
  });

  it('requires whitepaper metadata and derives read time when blank', async () => {
    const admin = await createTestUser();
    const site = await createTestSite();
    const request = (json: unknown) =>
      authenticatedRequest('http://localhost:3003/api/admin/whitepapers', {
        user: admin,
        siteId: site._id.toString(),
        method: 'POST',
        json,
      });
    expect(
      (
        await createWhitepaper(
          await request({ title: 'Paper', slug: 'paper', content: 'Body' }),
          rootContext,
        )
      ).status,
    ).toBe(400);
    const content = `<p>${Array.from({ length: 239 }, () => 'word').join(' ')}</p>`;
    expect(
      (
        await createWhitepaper(
          await request({
            title: ' Paper ',
            slug: 'paper',
            description: ' Description ',
            content,
            readTime: ' ',
            status: 'draft',
          }),
          rootContext,
        )
      ).status,
    ).toBe(201);
    const paper = await Whitepaper.findOne({ siteId: site._id }).exec();
    expect(paper).toMatchObject({
      title: 'Paper',
      description: 'Description',
      readTime: '2 min read',
    });
    expect(paper?.createdBy?.toString()).toBe(admin._id.toString());

    const modelOnly = await Whitepaper.create({
      siteId: site._id,
      title: 'Imported paper',
      slug: 'imported-paper',
      description: 'Imported',
      content: 'Model-level fallback',
      readTime: '',
    });
    expect(modelOnly.readTime).toBe('1 min read');
  });
});
