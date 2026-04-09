import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { requireTwilioSignature } from '../lib/twilio-validation.js';
import { dispatchWebhook } from '../lib/webhook-dispatcher.js';

function parseRecordingDuration(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function toMp3RecordingUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value.endsWith('.mp3') ? value : `${value}.mp3`;
}

export async function registerVoiceRecordingWebhookRoutes(app: FastifyInstance) {
  app.post('/v1/twilio/voice/recording-status', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string | undefined>;

    const sigCheck = requireTwilioSignature(request, body);
    if (!sigCheck.valid) {
      app.log.warn({ msg: 'Twilio recording signature validation failed', error: sigCheck.error });
      return reply.status(403).send({ ok: false, error: 'Request validation failed' });
    }

    const twilioCallSid = body.CallSid ?? '';
    if (!twilioCallSid) {
      app.log.warn({ msg: 'Twilio recording callback missing CallSid' });
      return reply.status(200).send();
    }

    const existingCall = await prisma.call.findUnique({
      where: { twilioCallSid },
      select: {
        id: true,
        tenantId: true,
        twilioCallSid: true,
        fromE164: true,
        toE164: true,
        leadName: true,
        leadPhone: true,
        leadIntent: true,
        urgency: true,
        serviceAddress: true,
        summary: true
      }
    });

    if (!existingCall) {
      app.log.info({ msg: 'Twilio recording callback for unknown call', twilioCallSid });
      return reply.status(200).send();
    }

    const recordingStatus = body.RecordingStatus ?? null;
    const recordingSid = body.RecordingSid ?? null;
    const recordingUrl = toMp3RecordingUrl(body.RecordingUrl);
    const recordingDuration = parseRecordingDuration(body.RecordingDuration);

    await prisma.call.update({
      where: { id: existingCall.id },
      data: {
        recordingUrl,
        recordingSid,
        recordingDuration,
        recordingStatus
      }
    });

    if (recordingStatus === 'completed') {
      app.log.info({
        msg: 'Call recording stored',
        twilioCallSid,
        recordingSid,
        recordingDuration
      });

      if (recordingUrl) {
        void dispatchWebhook(existingCall.tenantId, 'call.recording.ready', {
          callSid: existingCall.twilioCallSid,
          recordingSid,
          recordingUrl,
          recordingDuration,
          recordingStatus,
          fromE164: existingCall.fromE164,
          toE164: existingCall.toE164,
          leadName: existingCall.leadName,
          leadPhone: existingCall.leadPhone,
          leadIntent: existingCall.leadIntent,
          urgency: existingCall.urgency,
          serviceAddress: existingCall.serviceAddress,
          summary: existingCall.summary
        }).catch((error: unknown) => {
          app.log.error({
            msg: 'Failed to dispatch recording-ready webhook',
            twilioCallSid,
            error
          });
        });
      }
    } else if (recordingStatus === 'absent' || recordingStatus === 'failed') {
      app.log.warn({
        msg: 'Call recording unavailable',
        twilioCallSid,
        recordingStatus,
        recordingSid
      });
    }

    return reply.status(200).send();
  });
}
