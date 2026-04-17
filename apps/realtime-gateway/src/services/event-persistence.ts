/**
 * Call event persistence with automatic call context resolution and retry.
 *
 * On the first call, `ensureCallContext()` looks up the Call record by
 * `twilioCallSid` and caches the `callId` + current event count. Subsequent
 * calls return the cached context immediately.
 *
 * `persistEvent()` creates a CallEvent with a monotonically increasing
 * sequence number. If a unique constraint violation occurs (concurrent writers),
 * it re-reads the count and retries up to 3 times before throwing.
 */

import { prisma } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';
import type { FastifyBaseLogger } from 'fastify';
import type { JsonRecord } from '../types.js';

export interface CallContext {
  callId: string;
  sequence: number;
}

export class EventPersistence {
  private callId: string | null = null;
  private sequence = 0;
  private queryCallSid: string | null;
  private readonly log: FastifyBaseLogger;

  constructor(queryCallSid: string | null, log: FastifyBaseLogger) {
    this.queryCallSid = queryCallSid;
    this.log = log;
  }

  setCallSid(callSid: string | null): void {
    if (this.queryCallSid === callSid) {
      return;
    }

    this.queryCallSid = callSid;
    this.callId = null;
    this.sequence = 0;
  }

  /**
   * Resolves and caches the call context (callId + current sequence).
   * Returns null if `queryCallSid` is missing or the call doesn't exist in the DB.
   */
  async ensureCallContext(): Promise<CallContext | null> {
    if (this.callId) {
      return { callId: this.callId, sequence: this.sequence };
    }

    if (!this.queryCallSid) return null;

    const call = await prisma.call.findUnique({
      where: { twilioCallSid: this.queryCallSid },
      select: { id: true }
    });

    if (!call) {
      this.log.warn({ msg: 'call not found for media stream', callSid: this.queryCallSid });
      return null;
    }

    const count = await prisma.callEvent.count({ where: { callId: call.id } });

    this.callId = call.id;
    this.sequence = count;

    return { callId: this.callId, sequence: this.sequence };
  }

  /**
   * Persists a CallEvent with retry on unique constraint violation.
   *
   * The sequence number is determined by counting existing events for the call,
   * then incrementing. If another writer inserts between the count and the create,
   * the unique constraint on (callId, sequence) fires and we retry (up to 3 times).
   *
   * Silently skips if no call context is available.
   */
  async persistEvent(type: string, payloadJson: JsonRecord): Promise<void> {
    const context = await this.ensureCallContext();
    if (!context) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      const count = await prisma.callEvent.count({ where: { callId: context.callId } });

      try {
        await prisma.callEvent.create({
          data: {
            callId: context.callId,
            type,
            sequence: count + 1,
            payloadJson: payloadJson as Prisma.InputJsonValue
          }
        });
        this.sequence = count + 1;
        return;
      } catch (error: unknown) {
        const isUniqueViolation =
          error instanceof Error &&
          (error.message.includes('Unique constraint') ||
            error.message.includes('unique constraint'));
        if (!isUniqueViolation || attempt === 2) throw error;
      }
    }
  }
}
