import { describe, expect, it } from 'vitest';
import { faqInputSchema, faqUpdateSchema } from './faq';
import { faqSubmissionUpdateSchema, publicFaqSubmissionSchema } from './faq-submission';

describe('FAQ validation', () => {
  it('requires a question and answer and trims them', () => {
    expect(faqInputSchema.parse({ question: ' Q? ', answer: ' A. ' })).toMatchObject({
      question: 'Q?',
      answer: 'A.',
    });
    expect(faqInputSchema.safeParse({ question: '  ', answer: 'A.' }).success).toBe(false);
    expect(faqInputSchema.safeParse({ question: 'Q?' }).success).toBe(false);
  });

  it('only accepts a non-negative integer order and a known status', () => {
    for (const order of [-1, 1.5, '2']) {
      expect(faqInputSchema.safeParse({ question: 'Q', answer: 'A', order }).success).toBe(false);
    }
    expect(faqInputSchema.safeParse({ question: 'Q', answer: 'A', status: 'live' }).success).toBe(
      false,
    );
  });

  it('strips unknown fields such as siteId so a payload cannot move tenants', () => {
    const parsed = faqInputSchema.parse({ question: 'Q', answer: 'A', siteId: 'other' });
    expect(parsed).not.toHaveProperty('siteId');
    expect(faqUpdateSchema.parse({ siteId: 'other', createdBy: 'x' })).toEqual({});
  });

  it('does not let an update blank out the category', () => {
    expect(faqUpdateSchema.safeParse({ category: '' }).success).toBe(false);
  });
});

describe('FAQ submission validation', () => {
  it('normalises public submissions and rejects a bad email', () => {
    expect(publicFaqSubmissionSchema.parse({ question: ' Q? ', email: ' A@B.COM ' })).toMatchObject(
      { question: 'Q?', email: 'a@b.com' },
    );
    expect(publicFaqSubmissionSchema.safeParse({ question: 'Q?', email: 'nope' }).success).toBe(
      false,
    );
    expect(publicFaqSubmissionSchema.safeParse({ question: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('only allows the three triage statuses', () => {
    for (const status of ['pending', 'answered', 'dismissed']) {
      expect(faqSubmissionUpdateSchema.safeParse({ status }).success).toBe(true);
    }
    expect(faqSubmissionUpdateSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });
});
