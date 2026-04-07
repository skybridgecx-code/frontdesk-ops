import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authorizeWebSocket } from '../ws-auth.js';

function makeSocket() {
  return {
    closed: false,
    closeCode: 0,
    closeReason: '',
    close(code: number, reason: string) {
      this.closed = true;
      this.closeCode = code;
      this.closeReason = reason;
    }
  } as any;
}

function makeLogger() {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  } as any;
}

describe('authorizeWebSocket', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows connection when no secret is configured (dev mode)', () => {
    delete process.env.FRONTDESK_INTERNAL_API_SECRET;
    const socket = makeSocket();
    const result = authorizeWebSocket(socket, null, 'CA123', makeLogger());
    expect(result).toBe(true);
    expect(socket.closed).toBe(false);
  });

  it('allows connection with correct token', () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'my-secret-token';
    const socket = makeSocket();
    const result = authorizeWebSocket(socket, 'my-secret-token', 'CA123', makeLogger());
    expect(result).toBe(true);
    expect(socket.closed).toBe(false);
  });

  it('rejects connection with wrong token', () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'my-secret-token';
    const socket = makeSocket();
    const log = makeLogger();
    const result = authorizeWebSocket(socket, 'wrong-token!!', 'CA123', log);
    expect(result).toBe(false);
    expect(socket.closed).toBe(true);
    expect(socket.closeCode).toBe(4401);
    expect(socket.closeReason).toBe('Unauthorized');
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('rejects connection with missing token', () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'my-secret-token';
    const socket = makeSocket();
    const result = authorizeWebSocket(socket, null, 'CA123', makeLogger());
    expect(result).toBe(false);
    expect(socket.closed).toBe(true);
    expect(socket.closeCode).toBe(4401);
  });

  it('rejects connection with empty token', () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'my-secret-token';
    const socket = makeSocket();
    const result = authorizeWebSocket(socket, '', 'CA123', makeLogger());
    expect(result).toBe(false);
    expect(socket.closed).toBe(true);
  });

  it('rejects token with different length (timing-safe)', () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'exact-16-chars!';
    const socket = makeSocket();
    const result = authorizeWebSocket(socket, 'short', 'CA123', makeLogger());
    expect(result).toBe(false);
    expect(socket.closed).toBe(true);
  });
});
