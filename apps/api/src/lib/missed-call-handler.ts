import { CallStatus, prisma } from '@frontdesk/db';
import { getTwilioClient } from './twilio-client.js';

const QUICK_HANGUP_SECONDS = 10;

function isMissedCall(status: CallStatus, durationSeconds: number | null) {
  if (
    status === CallStatus.NO_ANSWER ||
    status === CallStatus.BUSY ||
    status === CallStatus.CANCELED ||
    status === CallStatus.FAILED
  ) {
    return true;
  }

  if (status === CallStatus.COMPLETED && durationSeconds !== null && durationSeconds < QUICK_HANGUP_SECONDS) {
    return true;
  }

  return false;
}

function buildDefaultTextBackMessage(businessName: string) {
  return `Hi! Sorry we missed your call to ${businessName}. We got your message and will get back to you shortly. If this is urgent, please call back and we'll prioritize your request. — ${businessName}`;
}

async function createTextBackSentEvent(input: {
  callId: string;
  to: string;
  from: string;
  message: string;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const existingEventCount = await prisma.callEvent.count({
      where: { callId: input.callId }
    });

    try {
      await prisma.callEvent.create({
        data: {
          callId: input.callId,
          type: 'textback.sent',
          sequence: existingEventCount + 1,
          payloadJson: {
            to: input.to,
            from: input.from,
            message: input.message
          }
        }
      });
      return;
    } catch (error: unknown) {
      const isUniqueViolation =
        error instanceof Error &&
        (error.message.includes('Unique constraint') || error.message.includes('unique constraint'));

      if (!isUniqueViolation || attempt === 2) {
        console.error('Failed to persist text-back event', {
          error,
          callId: input.callId
        });
      }

      if (!isUniqueViolation) {
        return;
      }
    }
  }
}

async function findDestinationPhoneNumber(input: {
  phoneNumberId: string;
  toE164: string | null;
  tenantId: string;
  businessId: string;
}) {
  const byId = await prisma.phoneNumber.findFirst({
    where: {
      id: input.phoneNumberId,
      tenantId: input.tenantId,
      businessId: input.businessId,
      isActive: true
    },
    select: {
      e164: true,
      enableMissedCallTextBack: true
    }
  });

  if (byId) {
    return byId;
  }

  if (!input.toE164) {
    return null;
  }

  return prisma.phoneNumber.findFirst({
    where: {
      e164: input.toE164,
      tenantId: input.tenantId,
      businessId: input.businessId,
      isActive: true
    },
    select: {
      e164: true,
      enableMissedCallTextBack: true
    }
  });
}

export async function handleMissedCall(callSid: string) {
  try {
    if (!callSid.trim()) {
      return;
    }

    const call = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
      select: {
        id: true,
        tenantId: true,
        businessId: true,
        phoneNumberId: true,
        toE164: true,
        status: true,
        durationSeconds: true,
        fromE164: true,
        textBackSent: true,
        business: {
          select: {
            name: true,
            agentProfiles: {
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: {
                id: true,
                missedCallTextBackMessage: true
              }
            }
          }
        },
        agentProfile: {
          select: {
            id: true,
            missedCallTextBackMessage: true
          }
        }
      }
    });

    if (!call || call.textBackSent) {
      return;
    }

    if (!isMissedCall(call.status, call.durationSeconds)) {
      return;
    }

    const destinationPhoneNumber = await findDestinationPhoneNumber({
      phoneNumberId: call.phoneNumberId,
      toE164: call.toE164,
      tenantId: call.tenantId,
      businessId: call.businessId
    });

    if (!destinationPhoneNumber || !destinationPhoneNumber.enableMissedCallTextBack) {
      return;
    }

    if (!call.fromE164) {
      return;
    }

    const messageTemplate =
      call.agentProfile?.missedCallTextBackMessage ??
      call.business.agentProfiles[0]?.missedCallTextBackMessage ??
      null;

    const message = messageTemplate?.trim().length
      ? messageTemplate.trim()
      : buildDefaultTextBackMessage(call.business.name);

    try {
      const client = getTwilioClient();
      await client.messages.create({
        from: destinationPhoneNumber.e164,
        to: call.fromE164,
        body: message
      });
    } catch (error: unknown) {
      console.error('Failed to send missed-call text-back', {
        error,
        callSid,
        to: call.fromE164,
        from: destinationPhoneNumber.e164
      });
      return;
    }

    const sentAt = new Date();

    await prisma.call.update({
      where: { id: call.id },
      data: {
        textBackSent: true,
        textBackSentAt: sentAt
      }
    });

    await createTextBackSentEvent({
      callId: call.id,
      to: call.fromE164,
      from: destinationPhoneNumber.e164,
      message
    });
  } catch (error: unknown) {
    console.error('Failed to handle missed call text-back', {
      error,
      callSid
    });
  }
}
