import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connect: vi.fn(), isConnected: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({
  default: mocks.connect,
  isDatabaseConnected: mocks.isConnected,
}));

import { GET } from './route';

describe('health check', () => {
  beforeEach(() => {
    mocks.connect.mockReset();
    mocks.isConnected.mockReset();
  });

  it('returns 200 when the database is connected', async () => {
    mocks.connect.mockResolvedValue(undefined);
    mocks.isConnected.mockReturnValue(true);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, db: true });
  });

  it('returns 503 when the connection is not ready', async () => {
    mocks.connect.mockResolvedValue(undefined);
    mocks.isConnected.mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: true, db: false });
  });

  it('returns 503 instead of throwing when connecting fails', async () => {
    mocks.connect.mockRejectedValue(new Error('ECONNREFUSED'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: true, db: false });
  });
});
