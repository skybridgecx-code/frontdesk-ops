import type { FastifyInstance } from 'fastify';
import { CallStatus, prisma } from '@frontdesk/db';
import { sendTwilioSms } from '@frontdesk/integrations';

const MISSED_CALL_TEXT_SENT_EVENT = 'twilio.sms.missed-call-text.sent';
const MISSED_CALL_TEXT_FAILED_EVENT = 'twilio.sms.missed-call-text.failed';

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

function shouldSendMissedCallTextBack(status: typeof CallStatus[keyof typeof CallStatus]) {
  return status === CallStatus.NO_ANSWER || status === CallStatus.BUSY;
}

function buildMissedCallTextBackMessage(businessName: string | null | undefined) {
  const prefix = businessName ? `Sorry we missed your call to ${businessName}.` : 'Sorry we missed your call.';
  return `${prefix} Reply to this text and our team will follow up shortly.`;
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
        endedAt: true,
        fromE164: true,
        business: {
          select: {
            name: true
          }
        },
        phoneNumber: {
          select: {
            e164: true,
            enableMissedCallTextBack: true
          }
        }
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

    if (
      shouldSendMissedCallTextBack(mappedStatus) &&
      !existingCall.answeredAt &&
      existingCall.phoneNumber.enableMissedCallTextBack &&
      existingCall.fromE164
    ) {
      const existingSentEvent = await prisma.callEvent.findFirst({
        where: {
          callId: existingCall.id,
          type: MISSED_CALL_TEXT_SENT_EVENT
        },
        select: {
          id: true
        }
      });

      if (!existingSentEvent) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
        const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
        const fromE164 = process.env.TWILIO_PHONE_NUMBER?.trim() || existingCall.phoneNumber.e164;

        try {
          if (!accountSid || !authToken || !fromE164) {
            throw new Error('Missing Twilio SMS configuration');
          }

          const result = await sendTwilioSms({
            accountSid,
            authToken,
            fromE164,
            toE164: existingCall.fromE164,
            body: buildMissedCallTextBackMessage(existingCall.business?.name)
          });

          await prisma.callEvent.create({
            data: {
              callId: existingCall.id,
              type: MISSED_CALL_TEXT_SENT_EVENT,
              sequence: eventCount + 2,
              payloadJson: {
                messageSid: result.messageSid,
                fromE164,
                toE164: existingCall.fromE164
              }
            }
          });
        } catch (error) {
          await prisma.callEvent.create({
            data: {
              callId: existingCall.id,
              type: MISSED_CALL_TEXT_FAILED_EVENT,
              sequence: eventCount + 2,
              payloadJson: {
                fromE164,
                toE164: existingCall.fromE164,
                error: error instanceof Error ? error.message : 'Unknown missed-call text-back failure'
              }
            }
          });
        }
      }
    }

    return {
      ok: true,
      callId: existingCall.id,
      status: mappedStatus
    };
  });
}
