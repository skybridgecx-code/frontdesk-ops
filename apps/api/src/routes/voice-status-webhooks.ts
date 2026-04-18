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
import { CallDirection, CallStatus, prisma } from '@frontdesk/db';
import { requireTwilioSignature } from '../lib/twilio-validation.js';
import { handleMissedCall } from '../lib/missed-call-handler.js';

const STATUS_LOOKUP_RETRY_DELAYS_MS = [50, 100, 200] as const;

type CallStatusRecord = {
  id: string;
  twilioCallSid: string;
  answeredAt: Date | null;
  endedAt: Date | null;
};

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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUniqueConstraintViolation(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes('Unique constraint') || error.message.includes('unique constraint'))
  );
}

async function findCallForStatusCallback(twilioCallSid: string): Promise<CallStatusRecord | null> {
  return prisma.call.findFirst({
    where: {
      OR: [{ twilioCallSid }, { callSid: twilioCallSid }]
    },
    select: {
      id: true,
      twilioCallSid: true,
      answeredAt: true,
      endedAt: true
    }
  });
}

async function recoverCallFromStatusPayload(input: {
  twilioCallSid: string;
  body: Record<string, string | undefined>;
  mappedStatus: typeof CallStatus[keyof typeof CallStatus];
  parsedDuration: number | null;
}): Promise<{ call: CallStatusRecord | null; source: 'recovered-from-status-payload' | 'none' }> {
  const toE164 = input.body.To?.trim() ?? '';
  if (!toE164) {
    return { call: null, source: 'none' };
  }

  const phoneNumber = await prisma.phoneNumber.findUnique({
    where: { e164: toE164 },
    select: {
      id: true,
      tenantId: true,
      businessId: true,
      isActive: true
    }
  });

  if (!phoneNumber || !phoneNumber.isActive) {
    return { call: null, source: 'none' };
  }

  const now = new Date();

  try {
    const call = await prisma.call.create({
      data: {
        tenantId: phoneNumber.tenantId,
        businessId: phoneNumber.businessId,
        phoneNumberId: phoneNumber.id,
        direction: CallDirection.INBOUND,
        twilioCallSid: input.twilioCallSid,
        callSid: input.twilioCallSid,
        status: input.mappedStatus,
        fromE164: input.body.From ?? null,
        toE164: toE164,
        ...(input.mappedStatus === CallStatus.IN_PROGRESS ? { answeredAt: now } : {}),
        ...(isTerminalStatus(input.mappedStatus) ? { endedAt: now } : {}),
        ...(input.parsedDuration !== null ? { durationSeconds: input.parsedDuration } : {})
      },
      select: {
        id: true,
        twilioCallSid: true,
        answeredAt: true,
        endedAt: true
      }
    });

    return { call, source: 'recovered-from-status-payload' };
  } catch (error: unknown) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const call = await findCallForStatusCallback(input.twilioCallSid);
    return {
      call,
      source: call ? 'recovered-from-status-payload' : 'none'
    };
  }
}

async function resolveCallForStatusCallback(input: {
  twilioCallSid: string;
  body: Record<string, string | undefined>;
  mappedStatus: typeof CallStatus[keyof typeof CallStatus];
  parsedDuration: number | null;
}): Promise<{
  call: CallStatusRecord | null;
  source: 'sid' | 'recovered-from-status-payload' | 'none';
}> {
  let call = await findCallForStatusCallback(input.twilioCallSid);
  if (call) {
    return { call, source: 'sid' };
  }

  for (const retryDelayMs of STATUS_LOOKUP_RETRY_DELAYS_MS) {
    await wait(retryDelayMs);
    call = await findCallForStatusCallback(input.twilioCallSid);
    if (call) {
      return { call, source: 'sid' };
    }
  }

  const recovered = await recoverCallFromStatusPayload(input);
  return {
    call: recovered.call,
    source: recovered.source
  };
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

    const resolved = await resolveCallForStatusCallback({
      twilioCallSid,
      body,
      mappedStatus,
      parsedDuration
    });
    const existingCall = resolved.call;

    if (!existingCall) {
      app.log.warn({
        msg: 'Twilio status callback could not be correlated to a call',
        twilioCallSid,
        callStatus: rawCallStatus ?? null,
        fromE164: body.From ?? null,
        toE164: body.To ?? null
      });

      return reply.status(200).send({
        ok: true,
        correlated: false,
        status: mappedStatus
      });
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
      where: { id: existingCall.id },
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
      void handleMissedCall(existingCall.twilioCallSid).catch((error: unknown) => {
        app.log.error({
          msg: 'Failed to process missed-call text-back',
          twilioCallSid: existingCall.twilioCallSid,
          error
        });
      });
    }

    return {
      ok: true,
      callId: existingCall.id,
      status: mappedStatus,
      correlationSource: resolved.source
    };
  });
}
