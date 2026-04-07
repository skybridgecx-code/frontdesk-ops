import { prisma } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';
import type { FastifyBaseLogger } from 'fastify';
import type { JsonRecord } from '../types.js';

export interface CallContext {
  callId: string;
  sequence: number;
}

/**
 * Manages call context lookup and event persistence with retry on unique constraint violations.
 */
export class EventPersistence {
  private callId: string | null = null;
  private sequence = 0;
  private readonly queryCallSid: string | null;
  private readonly log: FastifyBaseLogger;

  constructor(queryCallSid: string | null, log: FastifyBaseLogger) {
    this.queryCallSid = queryCallSid;
    this.log = log;
  }

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
