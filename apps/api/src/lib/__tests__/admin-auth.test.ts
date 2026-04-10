import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAdminAuth } from '../admin-auth.js';

function createReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn()
  } as unknown as FastifyReply;
}

function createRequest(authorization?: string) {
  return {
    headers: {
      ...(authorization ? { authorization } : {})
    }
  } as unknown as FastifyRequest;
}

describe('requireAdminAuth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns 503 if FRONTDESK_INTERNAL_API_SECRET is not set', async () => {
    delete process.env.FRONTDESK_INTERNAL_API_SECRET;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reply = createReply();

    await requireAdminAuth(createRequest('Bearer secret'), reply);

    expect(errorSpy).toHaveBeenCalledWith('[admin-auth] FRONTDESK_INTERNAL_API_SECRET not set');
    expect((reply.code as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([503]);
    expect((reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      { error: 'Admin API not configured' }
    ]);
  });

  it('returns 401 if Authorization header is missing', async () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'admin_secret';

    const reply = createReply();

    await requireAdminAuth(createRequest(), reply);

    expect((reply.code as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([401]);
    expect((reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      { error: 'Authorization header required' }
    ]);
  });

  it('returns 403 if token does not match', async () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'admin_secret';

    const reply = createReply();

    await requireAdminAuth(createRequest('Bearer wrong_secret'), reply);

    expect((reply.code as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([403]);
    expect((reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      { error: 'Invalid admin credentials' }
    ]);
  });

  it('passes when Bearer token matches secret', async () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'admin_secret';

    const reply = createReply();

    await requireAdminAuth(createRequest('Bearer admin_secret'), reply);

    expect((reply.code as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('passes when raw token matches secret', async () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'admin_secret';

    const reply = createReply();

    await requireAdminAuth(createRequest('admin_secret'), reply);

    expect((reply.code as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
