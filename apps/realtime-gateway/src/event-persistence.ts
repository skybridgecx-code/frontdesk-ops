import { prisma } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';

export function createEventPersister(input: {
  ensureCallContext: () => Promise<{ callId: string; sequence: number } | null>;
  nextSequence: () => number;
}) {
  return async function persistEvent(type: string, payloadJson: Record<string, unknown>) {
    const context = await input.ensureCallContext();
    if (!context) {
      return;
    }

    const sequence = input.nextSequence();

    await prisma.callEvent.create({
      data: {
        callId: context.callId,
        type,
        sequence,
        payloadJson: payloadJson as Prisma.InputJsonValue
      }
    });
  };
}
