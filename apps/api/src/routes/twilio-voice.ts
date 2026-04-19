import type { FastifyInstance, FastifyReply } from 'fastify';
import { CallDirection, CallStatus, prisma } from '@frontdesk/db';
import { sendMissedCallEmail, sendVoicemailEmail } from '../lib/email-sender.js';
import { handleMissedCall } from '../lib/missed-call-handler.js';
import { validateTwilioRequest } from '../lib/twilio-auth.js';
import {
  buildCollectReasonTwiml,
  buildErrorTwiml,
  buildGreetingTwiml,
  buildThankYouTwiml,
  buildVoicemailCompleteTwiml
} from '../lib/twiml-builder.js';

/**
 * Live legacy Twilio voice flow.
 *
 * This route group serves the legacy gather/voicemail TwiML path under
 * `/v1/twilio/voice/*` and remains active during Retell/Telnyx migration
 * until explicit cutover/retirement decisions are complete.
 */
type TwilioVoicePayload = Record<string, string | undefined>;

type CallStatusUpdate = {
  callStatus: string;
  status: CallStatus;
  shouldSetCompletedAt: boolean;
};

function getBodyValue(value: string | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function toRecordingDuration(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function mapTwilioStatus(callStatus: string): CallStatusUpdate {
  switch (callStatus) {
    case 'completed':
      return {
        callStatus: 'completed',
        status: CallStatus.COMPLETED,
        shouldSetCompletedAt: true
      };
    case 'no-answer':
      return {
        callStatus: 'missed',
        status: CallStatus.NO_ANSWER,
        shouldSetCompletedAt: true
      };
    case 'busy':
      return {
        callStatus: 'missed',
        status: CallStatus.BUSY,
        shouldSetCompletedAt: true
      };
    case 'failed':
      return {
        callStatus: 'missed',
        status: CallStatus.FAILED,
        shouldSetCompletedAt: true
      };
    case 'canceled':
      return {
        callStatus: 'missed',
        status: CallStatus.CANCELED,
        shouldSetCompletedAt: true
      };
    case 'in-progress':
      return {
        callStatus: 'in-progress',
        status: CallStatus.IN_PROGRESS,
        shouldSetCompletedAt: false
      };
    default:
      return {
        callStatus: 'pending',
        status: CallStatus.RINGING,
        shouldSetCompletedAt: false
      };
  }
}

function sendTwiml(reply: FastifyReply, twiml: string) {
  reply.header('Content-Type', 'text/xml');
  return reply.send(twiml);
}

async function findCallBySid(callSid: string) {
  return prisma.call.findFirst({
    where: {
      OR: [{ callSid }, { twilioCallSid: callSid }]
    },
    select: {
      id: true,
      tenantId: true,
      callerName: true,
      callerPhone: true,
      callReason: true,
      voicemailDuration: true,
      createdAt: true,
      callStatus: true,
      twilioCallSid: true
    }
  });
}

async function findTenantForNotifications(tenantId: string) {
  return prisma.tenant.findUnique({
    where: {
      id: tenantId
    },
    select: {
      email: true,
      name: true,
      businessName: true,
      notifyEmail: true,
      notifyEmailVoicemail: true
    }
  });
}

function toCallTime(createdAt: Date | null | undefined) {
  return createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString();
}

async function findTenantAndPhoneByNumber(to: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      twilioPhoneNumber: to
    },
    select: {
      id: true,
      name: true,
      businessName: true,
      greeting: true,
      plan: true,
      subscriptionStatus: true
    }
  });

  if (!tenant) {
    return {
      tenant: null,
      phoneNumber: null
    };
  }

  const phoneNumber =
    (await prisma.phoneNumber.findFirst({
      where: {
        tenantId: tenant.id,
        e164: to,
        isActive: true
      },
      select: {
        id: true,
        businessId: true
      }
    })) ??
    (await prisma.phoneNumber.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true
      },
      select: {
        id: true,
        businessId: true
      }
    }));

  return {
    tenant,
    phoneNumber
  };
}

export async function registerLiveLegacyTwilioVoiceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', validateTwilioRequest);

  app.post('/v1/twilio/voice/incoming', async (request, reply) => {
    const body = (request.body ?? {}) as TwilioVoicePayload;
    const callSid = getBodyValue(body.CallSid);
    const from = getBodyValue(body.From);
    const to = getBodyValue(body.To);

    if (!callSid || !to) {
      return sendTwiml(reply, buildErrorTwiml());
    }

    const { tenant, phoneNumber } = await findTenantAndPhoneByNumber(to);
    if (!tenant || !phoneNumber) {
      return sendTwiml(reply, buildErrorTwiml());
    }

    if (tenant.plan === 'free' || tenant.subscriptionStatus !== 'active') {
      return sendTwiml(reply, buildErrorTwiml());
    }

    await prisma.call.upsert({
      where: {
        twilioCallSid: callSid
      },
      update: {
        callSid,
        callerPhone: from || null,
        fromE164: from || null,
        toE164: to,
        status: CallStatus.IN_PROGRESS,
        callStatus: 'in-progress',
        answeredAt: new Date(),
        twimlFlowStep: 'greeting'
      },
      create: {
        tenantId: tenant.id,
        businessId: phoneNumber.businessId,
        phoneNumberId: phoneNumber.id,
        callSid,
        twilioCallSid: callSid,
        direction: CallDirection.INBOUND,
        status: CallStatus.IN_PROGRESS,
        callStatus: 'in-progress',
        callerPhone: from || null,
        fromE164: from || null,
        toE164: to,
        answeredAt: new Date(),
        twimlFlowStep: 'greeting'
      }
    });

    const businessName = tenant.businessName ?? tenant.name ?? 'our office';
    return sendTwiml(reply, buildGreetingTwiml(businessName, tenant.greeting));
  });

  app.post('/v1/twilio/voice/collect-name', async (request, reply) => {
    const body = (request.body ?? {}) as TwilioVoicePayload;
    const callSid = getBodyValue(body.CallSid);
    const speechResult = getBodyValue(body.SpeechResult);

    if (!callSid) {
      return sendTwiml(reply, buildErrorTwiml());
    }

    const call = await findCallBySid(callSid);
    if (!call) {
      return sendTwiml(reply, buildErrorTwiml());
    }

    const callerName = speechResult || 'Unknown';

    await prisma.call.update({
      where: {
        id: call.id
      },
      data: {
        callerName,
        twimlFlowStep: 'collect-reason'
      }
    });

    return sendTwiml(reply, buildCollectReasonTwiml(speechResult || 'there'));
  });

  app.post('/v1/twilio/voice/collect-reason', async (request, reply) => {
    const body = (request.body ?? {}) as TwilioVoicePayload;
    const callSid = getBodyValue(body.CallSid);
    const speechResult = getBodyValue(body.SpeechResult);

    if (!callSid) {
      return sendTwiml(reply, buildErrorTwiml());
    }

    const call = await findCallBySid(callSid);
    if (!call) {
      return sendTwiml(reply, buildErrorTwiml());
    }

    await prisma.call.update({
      where: {
        id: call.id
      },
      data: {
        callReason: speechResult || 'Not specified',
        twimlFlowStep: 'thank-you'
      }
    });

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: call.tenantId
      },
      select: {
        name: true,
        businessName: true
      }
    });

    return sendTwiml(
      reply,
      buildThankYouTwiml(call.callerName || 'there', tenant?.businessName ?? tenant?.name ?? 'our office')
    );
  });

  app.post('/v1/twilio/voice/voicemail-complete', async (request, reply) => {
    const body = (request.body ?? {}) as TwilioVoicePayload;
    const callSid = getBodyValue(body.CallSid);
    const recordingUrl = getBodyValue(body.RecordingUrl);
    const recordingDuration = toRecordingDuration(getBodyValue(body.RecordingDuration));

    if (!callSid) {
      return sendTwiml(reply, buildErrorTwiml());
    }

    const call = await findCallBySid(callSid);
    if (!call) {
      return sendTwiml(reply, buildErrorTwiml());
    }

    await prisma.call.update({
      where: {
        id: call.id
      },
      data: {
        voicemailUrl: recordingUrl || null,
        voicemailDuration: recordingDuration,
        status: CallStatus.COMPLETED,
        callStatus: 'voicemail',
        twimlFlowStep: 'complete',
        completedAt: new Date()
      }
    });

    try {
      const tenant = await findTenantForNotifications(call.tenantId);

      if (tenant?.notifyEmailVoicemail && tenant.email) {
        await sendVoicemailEmail(tenant.email, {
          businessName: tenant.businessName ?? tenant.name ?? 'Your Business',
          callerPhone: call.callerPhone || 'Unknown',
          callerName: call.callerName ?? null,
          callReason: call.callReason ?? null,
          voicemailDuration: recordingDuration ?? call.voicemailDuration ?? null,
          callTime: toCallTime(call.createdAt),
          callId: call.id
        });
      }
    } catch (error) {
      request.log.error({ err: error, callId: call.id }, 'Failed to send voicemail email notification.');
    }

    return sendTwiml(reply, buildVoicemailCompleteTwiml());
  });

  app.post('/v1/twilio/voice/status-callback', async (request, reply) => {
    const body = (request.body ?? {}) as TwilioVoicePayload;
    const callSid = getBodyValue(body.CallSid);
    const twilioStatus = getBodyValue(body.CallStatus).toLowerCase();

    if (!callSid) {
      return reply.status(200).send({ received: true });
    }

    const call = await findCallBySid(callSid);

    if (!call || call.callStatus === 'voicemail') {
      return reply.status(200).send({ received: true });
    }

    const mapped = mapTwilioStatus(twilioStatus);

    await prisma.call.update({
      where: {
        id: call.id
      },
      data: {
        status: mapped.status,
        callStatus: mapped.callStatus,
        ...(mapped.shouldSetCompletedAt ? { completedAt: new Date() } : {})
      }
    });

    if (mapped.callStatus === 'missed') {
      await handleMissedCall(call.twilioCallSid || callSid);

      try {
        const tenant = await findTenantForNotifications(call.tenantId);

        if (tenant?.notifyEmail && tenant.email) {
          await sendMissedCallEmail(tenant.email, {
            businessName: tenant.businessName ?? tenant.name ?? 'Your Business',
            callerPhone: call.callerPhone || 'Unknown',
            callerName: call.callerName ?? null,
            callTime: toCallTime(call.createdAt),
            callId: call.id
          });
        }
      } catch (error) {
        request.log.error({ err: error, callId: call.id }, 'Failed to send missed-call email notification.');
      }
    }

    return reply.status(200).send({ received: true });
  });
}

export default registerLiveLegacyTwilioVoiceRoutes;
