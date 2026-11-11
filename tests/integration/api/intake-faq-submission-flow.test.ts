import { describe, expect, it } from 'vitest';
import { POST as submitFaq } from '@/app/api/v1/intake/faq-submissions/route';
import { GET as listSubmissions } from '@/app/api/admin/faq-submissions/route';
import {
  DELETE as deleteSubmission,
  PATCH as updateSubmission,
} from '@/app/api/admin/faq-submissions/[id]/route';
import { authenticatedRequest, createTestSite, createTestUser } from '@/tests/setup/factories';
import { issueTestApiKey, publicApiRequest } from '@/tests/setup/public-api';

const rootContext = { params: Promise.resolve({}) };

describe('public FAQ submission reaches the right admin inbox', () => {
  it('lands only on the key-bound site and can be triaged and deleted there', async () => {
    const admin = await createTestUser();
    const [siteA, siteB] = await Promise.all([createTestSite(), createTestSite()]);
    const key = await issueTestApiKey(siteA, admin, ['intake:write']);

    const submitted = await submitFaq(
      publicApiRequest('http://localhost:3003/api/v1/intake/faq-submissions', key, {
        method: 'POST',
        json: { question: 'Do you support SSO?', email: 'buyer@example.com' },
        headers: { 'x-cms-visitor-ip': '203.0.113.20' },
      }),
      rootContext,
    );
    expect(submitted.status).toBe(201);
    const { id } = (await submitted.json()).data;

    const request = (path: string, siteId: string, method = 'GET', json?: unknown) =>
      authenticatedRequest(`http://localhost:3003/api/admin/${path}`, {
        user: admin,
        siteId,
        method,
        json,
      });

    const inboxA = await (
      await listSubmissions(await request('faq-submissions', siteA._id.toString()), rootContext)
    ).json();
    expect(inboxA).toHaveLength(1);
    expect(inboxA[0]).toMatchObject({
      _id: id,
      question: 'Do you support SSO?',
      email: 'buyer@example.com',
      status: 'pending',
    });
    const inboxB = await (
      await listSubmissions(await request('faq-submissions', siteB._id.toString()), rootContext)
    ).json();
    expect(inboxB).toEqual([]);

    const params = { params: Promise.resolve({ id }) };
    const invalid = await updateSubmission(
      await request(`faq-submissions/${id}`, siteA._id.toString(), 'PATCH', { status: 'archived' }),
      params,
    );
    expect(invalid.status).toBe(400);

    const answered = await updateSubmission(
      await request(`faq-submissions/${id}`, siteA._id.toString(), 'PATCH', { status: 'answered' }),
      params,
    );
    expect(answered.status).toBe(200);
    expect((await answered.json()).status).toBe('answered');

    expect(
      (
        await deleteSubmission(
          await request(`faq-submissions/${id}`, siteB._id.toString(), 'DELETE', {}),
          params,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await deleteSubmission(
          await request(`faq-submissions/${id}`, siteA._id.toString(), 'DELETE', {}),
          params,
        )
      ).status,
    ).toBe(200);
    expect(
      await (
        await listSubmissions(await request('faq-submissions', siteA._id.toString()), rootContext)
      ).json(),
    ).toEqual([]);
  });
});
