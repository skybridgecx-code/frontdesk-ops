import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the module under test
vi.mock('@frontdesk/db', () => ({
  prisma: {
    call: {
      findUnique: vi.fn()
    },
    callEvent: {
      count: vi.fn(),
      create: vi.fn()
    }
  }
}));

import { prisma } from '@frontdesk/db';
import { EventPersistence } from '../event-persistence.js';

const mockPrisma = prisma as any;

function makeLogger() {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  } as any;
}

describe('EventPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureCallContext', () => {
    it('returns null when queryCallSid is null', async () => {
      const ep = new EventPersistence(null, makeLogger());
      expect(await ep.ensureCallContext()).toBeNull();
    });

    it('returns null when call is not found', async () => {
      mockPrisma.call.findUnique.mockResolvedValue(null);
      const ep = new EventPersistence('CA123', makeLogger());
      expect(await ep.ensureCallContext()).toBeNull();
    });

    it('returns callId and sequence from DB', async () => {
      mockPrisma.call.findUnique.mockResolvedValue({ id: 'call-1' });
      mockPrisma.callEvent.count.mockResolvedValue(5);

      const ep = new EventPersistence('CA123', makeLogger());
      const context = await ep.ensureCallContext();

      expect(context).toEqual({ callId: 'call-1', sequence: 5 });
    });

    it('caches callId after first lookup', async () => {
      mockPrisma.call.findUnique.mockResolvedValue({ id: 'call-1' });
      mockPrisma.callEvent.count.mockResolvedValue(5);

      const ep = new EventPersistence('CA123', makeLogger());
      await ep.ensureCallContext();
      await ep.ensureCallContext();

      // findUnique should only be called once
      expect(mockPrisma.call.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('persistEvent', () => {
    it('creates an event on first attempt', async () => {
      mockPrisma.call.findUnique.mockResolvedValue({ id: 'call-1' });
      mockPrisma.callEvent.count.mockResolvedValue(3);
      mockPrisma.callEvent.create.mockResolvedValue({});

      const ep = new EventPersistence('CA123', makeLogger());
      await ep.persistEvent('test.event', { foo: 'bar' });

      expect(mockPrisma.callEvent.create).toHaveBeenCalledWith({
        data: {
          callId: 'call-1',
          type: 'test.event',
          sequence: 4,
          payloadJson: { foo: 'bar' }
        }
      });
    });

    it('retries on unique constraint violation', async () => {
      mockPrisma.call.findUnique.mockResolvedValue({ id: 'call-1' });
      // First count returns 3, second count returns 4 (someone else inserted)
      mockPrisma.callEvent.count
        .mockResolvedValueOnce(3)  // ensureCallContext
        .mockResolvedValueOnce(3)  // first attempt
        .mockResolvedValueOnce(4); // retry attempt

      mockPrisma.callEvent.create
        .mockRejectedValueOnce(new Error('Unique constraint failed'))
        .mockResolvedValueOnce({});

      const ep = new EventPersistence('CA123', makeLogger());
      await ep.persistEvent('test.event', { foo: 'bar' });

      expect(mockPrisma.callEvent.create).toHaveBeenCalledTimes(2);
      // Second call should use sequence 5
      expect(mockPrisma.callEvent.create).toHaveBeenLastCalledWith({
        data: {
          callId: 'call-1',
          type: 'test.event',
          sequence: 5,
          payloadJson: { foo: 'bar' }
        }
      });
    });

    it('throws after 3 failed attempts', async () => {
      mockPrisma.call.findUnique.mockResolvedValue({ id: 'call-1' });
      mockPrisma.callEvent.count.mockResolvedValue(3);
      mockPrisma.callEvent.create.mockRejectedValue(
        new Error('Unique constraint failed')
      );

      const ep = new EventPersistence('CA123', makeLogger());
      await expect(ep.persistEvent('test.event', {})).rejects.toThrow(
        'Unique constraint failed'
      );
      expect(mockPrisma.callEvent.create).toHaveBeenCalledTimes(3);
    });

    it('throws immediately for non-unique errors', async () => {
      mockPrisma.call.findUnique.mockResolvedValue({ id: 'call-1' });
      mockPrisma.callEvent.count.mockResolvedValue(3);
      mockPrisma.callEvent.create.mockRejectedValue(new Error('Connection refused'));

      const ep = new EventPersistence('CA123', makeLogger());
      await expect(ep.persistEvent('test.event', {})).rejects.toThrow(
        'Connection refused'
      );
      expect(mockPrisma.callEvent.create).toHaveBeenCalledTimes(1);
    });

    it('silently skips when call context is null', async () => {
      const ep = new EventPersistence(null, makeLogger());
      await ep.persistEvent('test.event', { foo: 'bar' });
      expect(mockPrisma.callEvent.create).not.toHaveBeenCalled();
    });
  });
});
