import type { FastifyInstance } from 'fastify';
import { CallStatus, prisma } from '@frontdesk/db';

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

    const eventCount = await prisma.callEvent.count({
      where: { callId: existingCall.id }
    });

    await prisma.callEvent.create({
      data: {
        callId: existingCall.id,
        type: `twilio.status.${rawCallStatus ?? 'unknown'}`,
        sequence: eventCount + 1,
        payloadJson: body
      }
    });

    return {
      ok: true,
      callId: existingCall.id,
      status: mappedStatus
    };
  });
}
