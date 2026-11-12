import { describe, expect, it } from 'vitest';
import {
  commentCreateSchema,
  commentPatchSchema,
  heartbeatSchema,
  lockActionSchema,
  objectIdString,
  resourceQuerySchema,
} from '@/lib/validation/collaboration';

const id = '64b1f0c2a1b2c3d4e5f60789';

describe('collaboration request schemas', () => {
  it('accepts a canonical resource query and lowercases the id', () => {
    const parsed = resourceQuerySchema.parse({
      resourceType: 'blog',
      resourceId: id.toUpperCase(),
    });
    expect(parsed.resourceId).toBe(id);
  });

  it('rejects an unknown resource type or a non-object-id', () => {
    expect(resourceQuerySchema.safeParse({ resourceType: 'author', resourceId: id }).success).toBe(
      false,
    );
    expect(objectIdString.safeParse('not-an-id').success).toBe(false);
    expect(lockActionSchema.safeParse({ resourceType: 'blog', resourceId: id, action: 'steal' }).success).toBe(
      false,
    );
    expect(heartbeatSchema.safeParse({ resourceType: 'event', resourceId: id }).success).toBe(true);
  });

  it('requires a non-empty comment body and at least one patch field', () => {
    expect(
      commentCreateSchema.safeParse({
        resourceType: 'whitepaper',
        resourceId: id,
        body: '  Looks good  ',
        field: 'title',
      }).success,
    ).toBe(true);
    expect(
      commentCreateSchema.safeParse({ resourceType: 'blog', resourceId: id, body: '   ' }).success,
    ).toBe(false);
    expect(commentPatchSchema.safeParse({}).success).toBe(false);
    expect(commentPatchSchema.safeParse({ resolved: true }).success).toBe(true);
  });
});
