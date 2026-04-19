/**
 * Twilio Media Stream event handlers.
 *
 * Twilio sends three event types over the WebSocket media stream:
 *
 * - `start`  — Stream initialized. Contains `streamSid` and `callSid`.
 *   We store the stream ID on the Call record and persist a start event.
 *
 * - `media`  — An audio chunk (base64 mulaw). If the OpenAI WebSocket is
 *   ready, the chunk is forwarded immediately via `input_audio_buffer.append`.
 *   Otherwise it's queued in `state.pendingAudio` for later drain.
 *
 * - `stop`   — Stream ended (caller hung up or Twilio closed). We mark the
 *   call as COMPLETED, commit the audio buffer, and trigger a final response
 *   from OpenAI (or queue the trigger if not yet connected).
 */

import { prisma } from '@frontdesk/db';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SessionState, JsonRecord } from '../types.js';
import type { EventPersistence } from '../services/event-persistence.js';
import { isRecord, getString, getNumberOrString } from '../lib/ws-utils.js';

type StartAuthSource = 'query' | 'custom' | 'dev';

type StartAuthResult =
  | { valid: true; source: StartAuthSource }
  | { valid: false; reason: string };

export interface HandleStartResult {
  accepted: boolean;
  authenticated: boolean;
  authSource: StartAuthSource | null;
}

function getConfiguredInternalSecret() {
  const secret = process.env.FRONTDESK_INTERNAL_API_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function buildStartSignaturePayload(input: {
  callSid: string;
  phoneNumberId: string;
  tenantId: string;
  businessId: string;
  agentProfileId: string | null;
}) {
  return [
    input.callSid,
    input.phoneNumberId,
    input.tenantId,
    input.businessId,
    input.agentProfileId ?? ''
  ].join('|');
}

function validateStartAuthentication(input: {
  queryAuthVerified: boolean;
  startCallSid: string | null;
  customCallSid: string | null;
  customPhoneNumberId: string | null;
  customTenantId: string | null;
  customBusinessId: string | null;
  customAgentProfileId: string | null;
  customAuthSignature: string | null;
}): StartAuthResult {
  if (input.queryAuthVerified) {
    return { valid: true, source: 'query' };
  }

  const internalSecret = getConfiguredInternalSecret();
  if (!internalSecret) {
    return { valid: true, source: 'dev' };
  }

  if (
    !input.customCallSid ||
    !input.customPhoneNumberId ||
    !input.customTenantId ||
    !input.customBusinessId ||
    !input.customAuthSignature
  ) {
    return { valid: false, reason: 'missing_custom_auth_context' };
  }

  if (input.startCallSid && input.startCallSid !== input.customCallSid) {
    return { valid: false, reason: 'start_call_sid_mismatch' };
  }

  const expectedSignature = createHmac('sha256', internalSecret)
    .update(
      buildStartSignaturePayload({
        callSid: input.customCallSid,
        phoneNumberId: input.customPhoneNumberId,
        tenantId: input.customTenantId,
        businessId: input.customBusinessId,
        agentProfileId: input.customAgentProfileId
      })
    )
    .digest('hex');

  if (
    input.customAuthSignature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(input.customAuthSignature), Buffer.from(expectedSignature))
  ) {
    return { valid: false, reason: 'invalid_custom_auth_signature' };
  }

  return { valid: true, source: 'custom' };
}

/**
 * Handles the `start` event — stream initialization.
 * Authenticates stream context and links the stream SID to the Call record.
 */
export async function handleStart(
  message: JsonRecord,
  state: SessionState,
  events: EventPersistence,
  size: number,
  options?: {
    queryAuthVerified?: boolean;
  }
): Promise<HandleStartResult> {
  const start = isRecord(message.start) ? message.start : null;
  const customParameters = start && isRecord(start.customParameters) ? start.customParameters : null;

  const streamSid = start ? getString(start, 'streamSid') : null;
  const startCallSid = start ? getString(start, 'callSid') : null;
  const customCallSid = customParameters ? getString(customParameters, 'callSid') : null;
  const customPhoneNumberId = customParameters ? getString(customParameters, 'phoneNumberId') : null;
  const customTenantId = customParameters ? getString(customParameters, 'tenantId') : null;
  const customBusinessId = customParameters ? getString(customParameters, 'businessId') : null;
  const customAgentProfileId = customParameters ? getString(customParameters, 'agentProfileId') : null;
  const customAuthSignature = customParameters ? getString(customParameters, 'authSignature') : null;

  const messageCallSid = customCallSid ?? startCallSid ?? state.queryCallSid ?? null;
  const resolvedPhoneNumberId = customPhoneNumberId ?? state.phoneNumberId ?? null;
  const resolvedTenantId = customTenantId ?? state.tenantId ?? null;
  const resolvedBusinessId = customBusinessId ?? state.businessId ?? null;
  const resolvedAgentProfileId = customAgentProfileId ?? state.agentProfileId ?? null;

  const authResult = validateStartAuthentication({
    queryAuthVerified: options?.queryAuthVerified ?? false,
    startCallSid,
    customCallSid,
    customPhoneNumberId,
    customTenantId,
    customBusinessId,
    customAgentProfileId,
    customAuthSignature
  });

  if (!authResult.valid) {
    if (messageCallSid) {
      events.setCallSid(messageCallSid);
    }

    await events.persistEvent('twilio.media.start.rejected', {
      callSid: messageCallSid,
      streamSid,
      reason: authResult.reason,
      hasCustomParameters: Boolean(customParameters),
      hasAuthSignature: Boolean(customAuthSignature)
    });

    state.log.warn({
      msg: 'media stream start rejected',
      callSid: messageCallSid,
      streamSid,
      reason: authResult.reason
    });

    state.twilioSocket.close(4401, 'Unauthorized');
    return { accepted: false, authenticated: false, authSource: null };
  }

  if (!messageCallSid) {
    await events.persistEvent('twilio.media.start.rejected', {
      callSid: messageCallSid,
      streamSid,
      reason: 'missing_call_sid'
    });

    state.log.warn({
      msg: 'media stream start rejected',
      callSid: messageCallSid,
      streamSid,
      reason: 'missing_call_sid'
    });

    state.twilioSocket.close(4400, 'Bad Request');
    return { accepted: false, authenticated: false, authSource: null };
  }

  state.queryCallSid = messageCallSid;
  state.phoneNumberId = resolvedPhoneNumberId;
  state.tenantId = resolvedTenantId;
  state.businessId = resolvedBusinessId;
  state.agentProfileId = resolvedAgentProfileId;

  events.setCallSid(messageCallSid);

  if (messageCallSid && streamSid) {
    state.currentStreamSid = streamSid;
    await prisma.call.updateMany({
      where: { twilioCallSid: messageCallSid },
      data: { twilioStreamSid: streamSid }
    });
  }

  await events.persistEvent('twilio.media.start', {
    callSid: messageCallSid,
    streamSid,
    phoneNumberId: state.phoneNumberId,
    tenantId: state.tenantId,
    businessId: state.businessId,
    agentProfileId: state.agentProfileId,
    authSource: authResult.source,
    size
  });

  state.log.info({
    msg: 'media stream start received',
    callSid: messageCallSid,
    streamSid,
    phoneNumberId: state.phoneNumberId,
    agentProfileId: state.agentProfileId
  });

  return {
    accepted: true,
    authenticated: true,
    authSource: authResult.source
  };
}

/**
 * Handles the `media` event — an inbound audio chunk.
 *
 * If OpenAI is connected and ready, sends the audio immediately.
 * Otherwise queues it in `state.pendingAudio` to be drained when
 * the OpenAI bridge comes up.
 */
export function handleMedia(
  message: JsonRecord,
  state: SessionState
): void {
  const media = isRecord(message.media) ? message.media : null;
  const payload = media ? getString(media, 'payload') : null;

  state.log.info({
    msg: 'media stream media received',
    callSid: state.queryCallSid,
    streamSid: getString(message, 'streamSid'),
    chunk: media ? getNumberOrString(media, 'chunk') : null,
    track: media ? getString(media, 'track') : null
  });

  if (!payload) return;

  const streamSid = getString(message, 'streamSid');
  const chunk = media ? getNumberOrString(media, 'chunk') : null;
  const track = media ? getString(media, 'track') : null;
  state.hasUncommittedAudio = true;

  if (state.openAIReady && state.openAISocket && state.openAISocket.readyState === 1) {
    state.openAISocket.send(
      JSON.stringify({ type: 'input_audio_buffer.append', audio: payload })
    );

    state.log.info({
      msg: 'openai audio append sent',
      callSid: state.queryCallSid,
      streamSid,
      chunk,
      payloadSize: payload.length,
      source: 'live'
    });
  } else {
    state.pendingAudio.push({ payload, streamSid, chunk, track });

    state.log.info({
      msg: 'openai audio append queued',
      callSid: state.queryCallSid,
      streamSid,
      chunk,
      payloadSize: payload.length
    });
  }
}

/**
 * Handles the `stop` event — stream ended.
 *
 * 1. Persists a stop event.
 * 2. Marks the call as COMPLETED if still in progress.
 * 3. Commits the OpenAI audio buffer and triggers a final response
 *    (or queues the trigger if OpenAI isn't connected yet).
 */
export async function handleStop(
  message: JsonRecord,
  state: SessionState,
  events: EventPersistence,
  size: number
): Promise<void> {
  const stop = isRecord(message.stop) ? message.stop : null;
  const stopCallSid = (stop ? getString(stop, 'callSid') : null) ?? state.queryCallSid ?? null;
  const stopStreamSid = stop ? getString(stop, 'streamSid') : null;

  await events.persistEvent('twilio.media.stop', {
    callSid: stopCallSid,
    streamSid: stopStreamSid,
    size
  });

  const context = await events.ensureCallContext();
  if (context) {
    await prisma.call.updateMany({
      where: {
        id: context.callId,
        status: { in: ['RINGING', 'IN_PROGRESS'] }
      },
      data: {
        status: 'COMPLETED',
        endedAt: new Date()
      }
    });
  }

  state.log.info({
    msg: 'media stream stop received',
    callSid: stopCallSid,
    streamSid: stopStreamSid
  });

  if (!state.hasUncommittedAudio) {
    state.log.info({
      msg: 'openai response trigger skipped on stop: no uncommitted audio',
      callSid: stopCallSid,
      streamSid: stopStreamSid
    });
    return;
  }

  if (state.openAIReady && state.openAISocket && state.openAISocket.readyState === 1) {
    state.openAISocket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    state.hasUncommittedAudio = false;

    await events.persistEvent('openai.input_audio_buffer.commit.sent', {
      callSid: stopCallSid,
      streamSid: stopStreamSid,
      source: 'live'
    });

    state.log.info({
      msg: 'openai input_audio_buffer.commit sent',
      callSid: stopCallSid,
      streamSid: stopStreamSid,
      source: 'live'
    });

    if (!state.responseCreateInFlight) {
      state.openAISocket.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions: 'Respond naturally, briefly, and only in English to the caller.'
          }
        })
      );
      state.responseCreateInFlight = true;

      await events.persistEvent('openai.response.create.sent', {
        callSid: stopCallSid,
        streamSid: stopStreamSid,
        source: 'live'
      });

      state.log.info({
        msg: 'openai response.create sent',
        callSid: stopCallSid,
        streamSid: stopStreamSid,
        source: 'live'
      });
    }
  } else {
    state.pendingResponseTrigger = { callSid: stopCallSid, streamSid: stopStreamSid };

    await events.persistEvent('openai.response.trigger.queued', {
      callSid: stopCallSid,
      streamSid: stopStreamSid
    });

    state.log.info({
      msg: 'openai response trigger queued',
      callSid: stopCallSid,
      streamSid: stopStreamSid
    });
  }
}
