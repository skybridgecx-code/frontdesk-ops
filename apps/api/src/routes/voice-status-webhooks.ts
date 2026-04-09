/**
 * Twilio voice status callback webhook.
 *
 * Twilio POSTs status updates as a call progresses through its lifecycle:
 * ringing -> in-progress -> completed/busy/no-answer/failed/canceled.
 *
 * This handler:
 * 1. Validates the Twilio request signature.
 * 2. Maps the Twilio status string to our CallStatus enum.
 * 3. Updates the Call record (status, answeredAt, endedAt, durationSeconds).
 * 4. Persists a CallEvent for audit trail.
 *
 * Terminal statuses (completed, busy, no-answer, failed, canceled) trigger
 * setting endedAt. The in-progress status triggers setting answeredAt.
 */

import type { FastifyInstance } from 'fastify';
import { CallStatus, prisma } from '@frontdesk/db';
import { requireTwilioSignature } from '../lib/twilio-validation.js';
import { handleMissedCall } from '../lib/missed-call-handler.js';

/** Maps Twilio status strings to our CallStatus enum values. */
function mapTwilioStatus(status: string | undefined): typeof CallStatus[keyof typeof CallStatus] {
  switch (status) {
    case 'ringing':
      return CallStatus.RINGING;
    case 'in-progress':
      return CallStatus.IN_PROGRESS;
    case 'completed':
      return CallStatus.COMPLETED;
    case 'busy':
      return CallStatus.BUSY;
    case 'no-answer':
      return CallStatus.NO_ANSWER;
    case 'failed':
      return CallStatus.FAILED;
    case 'canceled':
      return CallStatus.CANCELED;
    default:
      return CallStatus.RINGING;
  }
}

/** Returns true if the status represents a terminal call state (no further updates expected). */
function isTerminalStatus(status: typeof CallStatus[keyof typeof CallStatus]) {
  return (
    status === CallStatus.COMPLETED ||
    status === CallStatus.BUSY ||
    status === CallStatus.NO_ANSWER ||
    status === CallStatus.FAILED ||
    status === CallStatus.CANCELED
  );
}

export async function registerVoiceStatusWebhookRoutes(app: FastifyInstance) {
  app.post('/v1/twilio/voice/status', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string | undefined>;

    const sigCheck = requireTwilioSignature(request, body);
    if (!sigCheck.valid) {
      app.log.warn({ msg: 'Twilio status signature validation failed', error: sigCheck.error });
      return reply.status(403).send({ ok: false, error: 'Request validation failed' });
    }

    const twilioCallSid = body.CallSid ?? '';
    const rawCallStatus = body.CallStatus;
    const mappedStatus = mapTwilioStatus(rawCallStatus);
    const parsedDuration =
      body.CallDuration && /^\d+$/.test(body.CallDuration) ? Number(body.CallDuration) : null;

    if (!twilioCallSid) {
      return reply.status(400).send({
        ok: false,
        error: 'CallSid is required'
      });
    }

    const existingCall = await prisma.call.findUnique({
      where: { twilioCallSid },
      select: {
        id: true,
        answeredAt: true,
        endedAt: true
      }
    });

    if (!existingCall) {
      return reply.notFound(`Call not found for CallSid=${twilioCallSid}`);
    }

    const updateData: {
      status: typeof mappedStatus;
      answeredAt?: Date;
      endedAt?: Date;
      durationSeconds?: number;
    } = {
      status: mappedStatus
    };

    if (mappedStatus === CallStatus.IN_PROGRESS && !existingCall.answeredAt) {
      updateData.answeredAt = new Date();
    }

    if (isTerminalStatus(mappedStatus) && !existingCall.endedAt) {
      updateData.endedAt = new Date();
    }

    if (parsedDuration !== null) {
      updateData.durationSeconds = parsedDuration;
    }

    await prisma.call.update({
      where: { twilioCallSid },
      data: updateData
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      const eventCount = await prisma.callEvent.count({
        where: { callId: existingCall.id }
      });
      try {
        await prisma.callEvent.create({
          data: {
            callId: existingCall.id,
            type: `twilio.status.${rawCallStatus ?? 'unknown'}`,
            sequence: eventCount + 1,
            payloadJson: body
          }
        });
        break;
      } catch (error: unknown) {
        const isUniqueViolation =
          error instanceof Error &&
          (error.message.includes('Unique constraint') ||
            error.message.includes('unique constraint'));
        if (!isUniqueViolation || attempt === 2) throw error;
      }
    }

    if (isTerminalStatus(mappedStatus)) {
      void handleMissedCall(twilioCallSid).catch((error: unknown) => {
        app.log.error({
          msg: 'Failed to process missed-call text-back',
          twilioCallSid,
          error
        });
      });
    }

    return {
      ok: true,
      callId: existingCall.id,
      status: mappedStatus
    };
  });
}
