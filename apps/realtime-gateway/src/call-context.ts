import { prisma } from '@frontdesk/db';
import type { FastifyBaseLogger } from 'fastify';

export type CallContext = {
  callId: string;
  sequence: number;
};

export function createCallContextResolver(input: {
  queryCallSid: string | null;
  log: FastifyBaseLogger;
}) {
  let callId: string | null = null;
  let sequence = 0;

  async function ensureCallContext(): Promise<CallContext | null> {
    if (callId) {
      return { callId, sequence };
    }

    if (!input.queryCallSid) {
      return null;
    }

    const call = await prisma.call.findUnique({
      where: { twilioCallSid: input.queryCallSid },
      select: { id: true }
    });

    if (!call) {
      input.log.warn({
        msg: 'call not found for media stream',
        callSid: input.queryCallSid
      });
      return null;
    }

    const count = await prisma.callEvent.count({
      where: { callId: call.id }
    });

    callId = call.id;
    sequence = count;

    return { callId, sequence };
  }

  function nextSequence() {
    sequence += 1;
    return sequence;
  }

  return {
    ensureCallContext,
    nextSequence
  };
}
