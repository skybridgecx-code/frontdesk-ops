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

type RetellCallOwnership = {
  tenantId: string;
  businessId: string;
  phoneNumberId: string;
};

function isUniqueConstraintViolation(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes('Unique constraint') || error.message.includes('unique constraint'))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown> | null, ...keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getNestedRecord(record: Record<string, unknown> | null, key: string) {
  if (!record) {
    return null;
  }

  const value = record[key];
  return isRecord(value) ? value : null;
}

function extractRetellSandboxAgentId(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  const call = getNestedRecord(payload, 'call');
  const metadata = getNestedRecord(payload, 'metadata');
  const callMetadata = getNestedRecord(call, 'metadata');
  const agent = getNestedRecord(payload, 'agent');
  const callAgent = getNestedRecord(call, 'agent');

  return (
    getString(call, 'agent_id', 'agentId', 'retell_agent_id', 'retellAgentId') ??
    getString(payload, 'agent_id', 'agentId', 'retell_agent_id', 'retellAgentId') ??
    getString(callMetadata, 'agent_id', 'agentId', 'retell_agent_id', 'retellAgentId') ??
    getString(metadata, 'agent_id', 'agentId', 'retell_agent_id', 'retellAgentId') ??
    getString(callAgent, 'id', 'agent_id', 'agentId') ??
    getString(agent, 'id', 'agent_id', 'agentId')
  );
}

function parseConfiguredRetellSandboxAgentIds() {
  const configured = process.env.FRONTDESK_RETELL_SANDBOX_AGENT_IDS;
  if (!configured) {
    return null;
  }

  const ids = configured
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (ids.length === 0) {
    return null;
  }

  return new Set(ids);
}

function resolveRetellSandboxOwnershipFallback(payload: unknown): RetellCallOwnership | null {
  const tenantId = process.env.FRONTDESK_RETELL_SANDBOX_TENANT_ID?.trim();
  const businessId = process.env.FRONTDESK_RETELL_SANDBOX_BUSINESS_ID?.trim();
  const phoneNumberId = process.env.FRONTDESK_RETELL_SANDBOX_PHONE_NUMBER_ID?.trim();
  if (!tenantId || !businessId || !phoneNumberId) {
    return null;
  }

  const agentId = extractRetellSandboxAgentId(payload);
  if (!agentId) {
    return null;
  }

  const configuredAgentIds = parseConfiguredRetellSandboxAgentIds();
  if (configuredAgentIds && !configuredAgentIds.has(agentId)) {
    return null;
  }

  return {
    tenantId,
    businessId,
    phoneNumberId
  };
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

async function resolveRetellCallOwnershipFromStatusPayload(input: {
  statusUpdate: NormalizedVoiceStatusUpdate;
  payload: unknown;
}) {
  const { statusUpdate, payload } = input;

  if (statusUpdate.tenantId && statusUpdate.businessId && statusUpdate.phoneNumberId) {
    return {
      tenantId: statusUpdate.tenantId,
      businessId: statusUpdate.businessId,
      phoneNumberId: statusUpdate.phoneNumberId
    };
  }

  const toE164 = statusUpdate.toE164?.trim();
  if (!toE164) {
    return resolveRetellSandboxOwnershipFallback(payload);
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
    return resolveRetellSandboxOwnershipFallback(payload);
  }

  return {
    tenantId: phoneNumber.tenantId,
    businessId: phoneNumber.businessId,
    phoneNumberId: phoneNumber.id
  };
}

async function recoverRetellCallFromStatusPayload(
  input: {
    statusUpdate: NormalizedVoiceStatusUpdate;
    payload: unknown;
  }
): Promise<RetellStatusCallRecord | null> {
  const ownership = await resolveRetellCallOwnershipFromStatusPayload(input);
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
        twilioCallSid: input.statusUpdate.providerCallId,
        callSid: input.statusUpdate.providerCallId,
        status: mapNormalizedVoiceStatusToCallStatus(input.statusUpdate.status),
        fromE164: input.statusUpdate.fromE164 ?? null,
        toE164: input.statusUpdate.toE164 ?? null
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
    return findCallForRetellWebhook(input.statusUpdate.providerCallId);
  }
}

async function resolveCallForRetellWebhook(input: {
  providerCallId: string;
  statusUpdate: NormalizedVoiceStatusUpdate | null;
  payload: unknown;
}) {
  const bySid = await findCallForRetellWebhook(input.providerCallId);
  if (bySid) {
    return { call: bySid, source: 'sid' as const };
  }

  if (!input.statusUpdate) {
    return { call: null, source: 'none' as const };
  }

  const recovered = await recoverRetellCallFromStatusPayload({
    statusUpdate: input.statusUpdate,
    payload: input.payload
  });
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
      statusUpdate,
      payload: body
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
