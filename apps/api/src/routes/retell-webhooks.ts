import type { FastifyInstance } from 'fastify';
import { CallDirection, prisma } from '@frontdesk/db';
import { mapNormalizedVoiceStatusToCallStatus } from '../lib/voice-provider/event-mapping.js';
import {
  applyNormalizedStatusUpdateToCall,
  persistNormalizedStatusEvent,
  persistNormalizedTranscriptArtifact
} from '../lib/voice-provider/persistence.js';
import type { NormalizedVoiceStatusUpdate } from '../lib/voice-provider/types.js';
import { getVoiceProviderAdapter } from '../lib/voice-provider/registry.js';

type RetellStatusCallRecord = {
  id: string;
  twilioCallSid: string;
  answeredAt: Date | null;
  endedAt: Date | null;
};

function isUniqueConstraintViolation(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes('Unique constraint') || error.message.includes('unique constraint'))
  );
}

async function findCallForRetellWebhook(providerCallId: string): Promise<RetellStatusCallRecord | null> {
  return prisma.call.findFirst({
    where: {
      OR: [{ twilioCallSid: providerCallId }, { callSid: providerCallId }]
    },
    select: {
      id: true,
      twilioCallSid: true,
      answeredAt: true,
      endedAt: true
    }
  });
}

async function resolveRetellCallOwnershipFromStatusPayload(statusUpdate: NormalizedVoiceStatusUpdate) {
  if (statusUpdate.tenantId && statusUpdate.businessId && statusUpdate.phoneNumberId) {
    return {
      tenantId: statusUpdate.tenantId,
      businessId: statusUpdate.businessId,
      phoneNumberId: statusUpdate.phoneNumberId
    };
  }

  const toE164 = statusUpdate.toE164?.trim();
  if (!toE164) {
    return null;
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
    return null;
  }

  return {
    tenantId: phoneNumber.tenantId,
    businessId: phoneNumber.businessId,
    phoneNumberId: phoneNumber.id
  };
}

async function recoverRetellCallFromStatusPayload(
  statusUpdate: NormalizedVoiceStatusUpdate
): Promise<RetellStatusCallRecord | null> {
  const ownership = await resolveRetellCallOwnershipFromStatusPayload(statusUpdate);
  if (!ownership) {
    return null;
  }

  try {
    return await prisma.call.create({
      data: {
        tenantId: ownership.tenantId,
        businessId: ownership.businessId,
        phoneNumberId: ownership.phoneNumberId,
        direction: CallDirection.INBOUND,
        twilioCallSid: statusUpdate.providerCallId,
        callSid: statusUpdate.providerCallId,
        status: mapNormalizedVoiceStatusToCallStatus(statusUpdate.status),
        fromE164: statusUpdate.fromE164 ?? null,
        toE164: statusUpdate.toE164 ?? null
      },
      select: {
        id: true,
        twilioCallSid: true,
        answeredAt: true,
        endedAt: true
      }
    });
  } catch (error: unknown) {
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
    return findCallForRetellWebhook(statusUpdate.providerCallId);
  }
}

async function resolveCallForRetellWebhook(input: {
  providerCallId: string;
  statusUpdate: NormalizedVoiceStatusUpdate | null;
}) {
  const bySid = await findCallForRetellWebhook(input.providerCallId);
  if (bySid) {
    return { call: bySid, source: 'sid' as const };
  }

  if (!input.statusUpdate) {
    return { call: null, source: 'none' as const };
  }

  const recovered = await recoverRetellCallFromStatusPayload(input.statusUpdate);
  if (!recovered) {
    return { call: null, source: 'none' as const };
  }

  return { call: recovered, source: 'created-from-status-payload' as const };
}

/**
 * Sandbox Retell webhook ingress.
 *
 * This route is intentionally parallel-only and persists normalized Retell
 * lifecycle data into existing Call/CallEvent storage without touching
 * Twilio production routing paths.
 */
export async function registerRetellWebhookRoutes(app: FastifyInstance) {
  app.post('/v1/twilio/retell/webhook', async (request, reply) => {
    const body = request.body ?? {};
    const retellAdapter = getVoiceProviderAdapter('retell');

    const statusUpdate = retellAdapter.normalizeStatusUpdate?.(body) ?? null;
    const transcriptArtifact = retellAdapter.normalizeTranscriptArtifact?.(body) ?? null;

    if (!statusUpdate && !transcriptArtifact) {
      return reply.status(400).send({
        ok: false,
        error: 'Unsupported Retell webhook payload'
      });
    }

    const providerCallId = statusUpdate?.providerCallId ?? transcriptArtifact?.providerCallId ?? '';
    if (!providerCallId) {
      return reply.status(400).send({
        ok: false,
        error: 'Retell call identifier is required'
      });
    }

    const resolved = await resolveCallForRetellWebhook({
      providerCallId,
      statusUpdate
    });

    if (!resolved.call) {
      return reply.status(202).send({
        ok: true,
        provider: 'retell',
        correlated: false,
        providerCallId
      });
    }

    const applied = {
      status: false,
      transcript: false
    };

    if (statusUpdate) {
      await applyNormalizedStatusUpdateToCall({
        call: resolved.call,
        statusUpdate
      });

      await persistNormalizedStatusEvent({
        callId: resolved.call.id,
        statusUpdate,
        payloadJson: body
      });

      applied.status = true;
    }

    if (transcriptArtifact) {
      const transcriptResult = await persistNormalizedTranscriptArtifact({
        callId: resolved.call.id,
        artifact: transcriptArtifact
      });
      applied.transcript = transcriptResult.updated;
    }

    return {
      ok: true,
      provider: 'retell',
      callId: resolved.call.id,
      providerCallId,
      correlationSource: resolved.source,
      applied
    };
  });
}
