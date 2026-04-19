/**
 * Twilio inbound voice webhook - the entry point for all incoming calls.
 *
 * Flow:
 * 1. Validate the Twilio request signature (reject with 403 if invalid).
 * 2. Look up the dialed phone number in the database.
 * 3. Check business hours to determine if the business is currently open.
 * 4. Resolve the call route based on the phone number routing mode:
 *    - AI_ALWAYS: always route to AI agent
 *    - AI_AFTER_HOURS: AI during hours, after-hours agent outside hours
 *    - HUMAN_ONLY: reject with a human-not-connected message
 *    - OVERFLOW: not yet implemented, falls through to human message
 * 5. Create/upsert the Call record and persist an inbound event.
 * 6. Return TwiML: either a Connect+Stream to the realtime gateway,
 *    or a Say+Hangup for non-AI routes.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { FastifyInstance } from 'fastify';
import { prisma, CallDirection, CallRouteKind, CallStatus, PhoneRoutingMode, Weekday } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';
import { requireTwilioSignature } from '../lib/twilio-validation.js';
import { enforceUsageLimits } from '../lib/usage-limiter.js';
import { twilioVoiceProviderAdapter } from '../lib/voice-provider/twilio.js';

/** Escapes XML special characters for safe embedding in TwiML responses. */
function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Returns TwiML that speaks a message and then hangs up. */
function twimlSayAndHangup(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`;
}

const AI_LINE_UNAVAILABLE_MESSAGE =
  'Thanks for calling. Our assistant is temporarily unavailable right now. Please try again shortly.';

/**
 * Returns TwiML that connects the call to a media stream WebSocket.
 *
 * Twilio forwards stream context through <Parameter> entries that arrive
 * in the first `start.customParameters` media event.
 */
function twimlConnectStream(input: {
  streamBaseUrl: string;
  callSid: string;
  phoneNumberId: string;
  tenantId: string;
  businessId: string;
  agentProfileId: string | null;
  authSignature: string | null;
  recordingStatusCallbackUrl: string;
}) {
  const streamUrl = input.streamBaseUrl.replace(/\/$/, '');
  const streamParams = [
    ['callSid', input.callSid],
    ['phoneNumberId', input.phoneNumberId],
    ['tenantId', input.tenantId],
    ['businessId', input.businessId]
  ] as Array<[string, string]>;

  if (input.agentProfileId) {
    streamParams.push(['agentProfileId', input.agentProfileId]);
  }

  if (input.authSignature) {
    streamParams.push(['authSignature', input.authSignature]);
  }

  const streamParamXml = streamParams
    .map(([name, value]) => `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}" />`)
    .join('');

  const escapedRecordingStatusCallbackUrl = escapeXml(input.recordingStatusCallbackUrl);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect record="record-from-answer-dual" recordingStatusCallback="${escapedRecordingStatusCallbackUrl}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed absent"><Stream url="${escapeXml(streamUrl)}">${streamParamXml}</Stream></Connect></Response>`;
}

/**
 * Creates an HMAC signature for Twilio custom stream parameters.
 * The raw internal secret never leaves the API process.
 */
function buildMediaStreamAuthSignature(input: {
  callSid: string;
  phoneNumberId: string;
  tenantId: string;
  businessId: string;
  agentProfileId: string | null;
  internalSecret: string | null;
}) {
  if (!input.internalSecret) return null;

  const payload = [
    input.callSid,
    input.phoneNumberId,
    input.tenantId,
    input.businessId,
    input.agentProfileId ?? ''
  ].join('|');

  return createHmac('sha256', input.internalSecret).update(payload).digest('hex');
}

/**
 * Returns the current weekday and HH:MM local time for the given timezone.
 * Used to check whether the business is currently open.
 */
function getWeekdayAndTime(timezone: string) {
  const weekdayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long'
  }).formatToParts(new Date());

  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const weekday = weekdayParts.find((part) => part.type === 'weekday')?.value ?? 'Monday';
  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '00';

  const weekdayMap: Record<string, typeof Weekday[keyof typeof Weekday]> = {
    Monday: Weekday.MONDAY,
    Tuesday: Weekday.TUESDAY,
    Wednesday: Weekday.WEDNESDAY,
    Thursday: Weekday.THURSDAY,
    Friday: Weekday.FRIDAY,
    Saturday: Weekday.SATURDAY,
    Sunday: Weekday.SUNDAY
  };

  return {
    weekday: weekdayMap[weekday] ?? Weekday.MONDAY,
    localTime: `${hour}:${minute}`
  };
}

/**
 * Checks whether the business is currently open based on its
 * configured business hours and timezone.
 */
function isBusinessOpen(
  timezone: string,
  hours: Array<{
    weekday: typeof Weekday[keyof typeof Weekday];
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
  }>
) {
  const { weekday, localTime } = getWeekdayAndTime(timezone);

  const today = hours.find((row) => row.weekday === weekday);
  if (!today) return false;
  if (today.isClosed) return false;
  if (!today.openTime || !today.closeTime) return false;

  return localTime >= today.openTime && localTime < today.closeTime;
}

function isLoopbackHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function resolveRequiredBaseUrl(input: {
  envName: string;
  value: string | undefined;
  allowedProtocols: Array<'http:' | 'https:' | 'ws:' | 'wss:'>;
}) {
  const raw = input.value?.trim();
  if (!raw) {
    return { ok: false as const, reason: `${input.envName} is not configured` };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false as const, reason: `${input.envName} is not a valid URL` };
  }

  if (!input.allowedProtocols.includes(parsed.protocol as 'http:' | 'https:' | 'ws:' | 'wss:')) {
    return {
      ok: false as const,
      reason: `${input.envName} must use ${input.allowedProtocols.join(' or ')}`
    };
  }

  if (isLoopbackHost(parsed.hostname)) {
    return { ok: false as const, reason: `${input.envName} cannot point to localhost or loopback` };
  }

  return { ok: true as const, value: parsed.toString().replace(/\/$/, '') };
}

function buildRealtimeHealthUrl(streamBaseUrl: string) {
  const parsed = new URL(streamBaseUrl);
  parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
  parsed.pathname = '/health';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

async function checkRealtimeGatewayReadiness(streamBaseUrl: string, timeoutMs = 1500) {
  const healthUrl = buildRealtimeHealthUrl(streamBaseUrl);
  const wsProbeUrl = streamBaseUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const health = await realtimeReadiness.checkHealth(healthUrl, timeoutMs);
    if (!health.ok) {
      if (attempt === 1) {
        return {
          ok: false as const,
          reason: health.reason,
          healthUrl,
          wsProbeUrl
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }

    const wsProbe = await realtimeReadiness.checkWebSocketUpgrade(wsProbeUrl, timeoutMs);
    if (wsProbe.ok) {
      return {
        ok: true as const,
        healthUrl,
        wsProbeUrl
      };
    }

    if (attempt === 1) {
      return {
        ok: false as const,
        reason: wsProbe.reason,
        healthUrl,
        wsProbeUrl
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return {
    ok: false as const,
    reason: 'realtime_readiness_unknown',
    healthUrl,
    wsProbeUrl
  };
}

export const realtimeReadiness = {
  async checkHealth(healthUrl: string, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        return {
          ok: false as const,
          reason: `realtime_health_http_${response.status}`
        };
      }

      return { ok: true as const };
    } catch {
      return {
        ok: false as const,
        reason: 'realtime_health_unreachable'
      };
    } finally {
      clearTimeout(timeout);
    }
  },

  checkWebSocketUpgrade(wsProbeUrl: string, timeoutMs: number) {
    const parsed = new URL(wsProbeUrl);
    const requestFn = parsed.protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise<
      | { ok: true }
      | { ok: false; reason: string }
    >((resolve) => {
      const request = requestFn(parsed, {
        method: 'GET',
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Key': randomBytes(16).toString('base64')
        }
      });

      let settled = false;
      const settle = (result: { ok: true } | { ok: false; reason: string }) => {
        if (settled) return;
        settled = true;
        request.destroy();
        resolve(result);
      };

      request.setTimeout(timeoutMs, () => {
        settle({ ok: false, reason: 'realtime_ws_upgrade_timeout' });
      });

      request.on('upgrade', (_response, socket) => {
        socket.destroy();
        settle({ ok: true });
      });

      request.on('response', (response) => {
        response.resume();
        settle({
          ok: false,
          reason: `realtime_ws_upgrade_http_${response.statusCode ?? 'unknown'}`
        });
      });

      request.on('error', () => {
        settle({ ok: false, reason: 'realtime_ws_upgrade_unreachable' });
      });

      request.end();
    });
  }
};

async function createCallEventWithRetry(input: {
  callId: string;
  type: string;
  payloadJson: unknown;
}) {
  function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const existingEventCount = await prisma.callEvent.count({
      where: { callId: input.callId }
    });
    try {
      await prisma.callEvent.create({
        data: {
          callId: input.callId,
          type: input.type,
          sequence: existingEventCount + 1,
          payloadJson: toPrismaJsonValue(input.payloadJson)
        }
      });
      return;
    } catch (error: unknown) {
      const isUniqueViolation =
        error instanceof Error &&
        (error.message.includes('Unique constraint') ||
          error.message.includes('unique constraint'));
      if (!isUniqueViolation || attempt === 2) throw error;
    }
  }
}

/**
 * Determines the call route based on the phone number routing mode
 * and whether the business is currently open.
 *
 * Returns the route kind (AI or HUMAN), the agent profile to use,
 * and a descriptive message for logging or fallback TwiML.
 */
function resolveRoute(input: {
  routingMode: typeof PhoneRoutingMode[keyof typeof PhoneRoutingMode];
  isOpen: boolean;
  primaryAgentProfileId: string | null;
  afterHoursAgentProfileId: string | null;
}) {
  const { routingMode, isOpen, primaryAgentProfileId, afterHoursAgentProfileId } = input;

  if (routingMode === PhoneRoutingMode.AI_ALWAYS) {
    return {
      routeKind: CallRouteKind.AI,
      agentProfileId: primaryAgentProfileId ?? afterHoursAgentProfileId ?? null,
      message: 'Connecting to AI front desk'
    };
  }

  if (routingMode === PhoneRoutingMode.AI_AFTER_HOURS) {
    if (isOpen) {
      return {
        routeKind: CallRouteKind.AI,
        agentProfileId: primaryAgentProfileId ?? null,
        message: 'Connecting to main AI front desk'
      };
    }

    return {
      routeKind: CallRouteKind.AI,
      agentProfileId: afterHoursAgentProfileId ?? primaryAgentProfileId ?? null,
      message: 'Connecting to after-hours AI front desk'
    };
  }

  if (routingMode === PhoneRoutingMode.HUMAN_ONLY) {
    return {
      routeKind: CallRouteKind.HUMAN,
      agentProfileId: null,
      message: 'Thanks for calling. Our team is not yet connected in this environment. Please call back shortly.'
    };
  }

  return {
    routeKind: CallRouteKind.HUMAN,
    agentProfileId: primaryAgentProfileId ?? null,
    message: 'Thanks for calling. Overflow routing is not yet connected in this environment.'
  };
}

export async function registerVoiceWebhookRoutes(app: FastifyInstance) {
  const enforceCallUsageLimits = enforceUsageLimits('calls');

  app.post('/v1/twilio/voice/inbound', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string | undefined>;

    const sigCheck = requireTwilioSignature(request, body);
    if (!sigCheck.valid) {
      app.log.warn({ msg: 'Twilio signature validation failed', error: sigCheck.error });
      reply.header('Content-Type', 'text/xml; charset=utf-8');
      return reply.status(403).send(
        twimlSayAndHangup('Request validation failed.')
      );
    }

    const normalizedInboundCall = twilioVoiceProviderAdapter.normalizeInboundCall?.(body) ?? null;
    const twilioCallSid = normalizedInboundCall?.providerCallId ?? '';
    const fromE164 = normalizedInboundCall?.fromE164 ?? null;
    const toE164 = normalizedInboundCall?.toE164 ?? null;

    if (!twilioCallSid || !toE164) {
      reply.header('Content-Type', 'text/xml; charset=utf-8');
      return reply.status(400).send(
        twimlSayAndHangup('We could not process your call because required call data was missing.')
      );
    }

    await enforceCallUsageLimits.call(app, request, reply, () => {});
    if (reply.sent) {
      return reply;
    }

    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { e164: toE164 },
      select: {
        id: true,
        tenantId: true,
        businessId: true,
        e164: true,
        label: true,
        isActive: true,
        routingMode: true,
        primaryAgentProfileId: true,
        afterHoursAgentProfileId: true,
        business: {
          select: {
            id: true,
            name: true,
            timezone: true,
            businessHours: {
              select: {
                weekday: true,
                openTime: true,
                closeTime: true,
                isClosed: true
              }
            }
          }
        }
      }
    });

    if (!phoneNumber || !phoneNumber.isActive) {
      reply.header('Content-Type', 'text/xml; charset=utf-8');
      return reply.status(404).send(
        twimlSayAndHangup('This number is not configured.')
      );
    }

    const openNow = isBusinessOpen(
      phoneNumber.business.timezone,
      phoneNumber.business.businessHours
    );

    const route = resolveRoute({
      routingMode: phoneNumber.routingMode,
      isOpen: openNow,
      primaryAgentProfileId: phoneNumber.primaryAgentProfileId,
      afterHoursAgentProfileId: phoneNumber.afterHoursAgentProfileId
    });

    const call = await prisma.call.upsert({
      where: { twilioCallSid },
      update: {
        status: CallStatus.RINGING,
        routeKind: route.routeKind,
        agentProfileId: route.agentProfileId,
        fromE164,
        toE164
      },
      create: {
        tenantId: phoneNumber.tenantId,
        businessId: phoneNumber.businessId,
        phoneNumberId: phoneNumber.id,
        agentProfileId: route.agentProfileId,
        twilioCallSid,
        direction: CallDirection.INBOUND,
        status: CallStatus.RINGING,
        routeKind: route.routeKind,
        fromE164,
        toE164
      },
      select: {
        id: true,
        phoneNumberId: true,
        agentProfileId: true
      }
    });

    await createCallEventWithRetry({
      callId: call.id,
      type: 'twilio.inbound.received',
      payloadJson: body
    });

    reply.header('Content-Type', 'text/xml; charset=utf-8');

    if (route.routeKind === CallRouteKind.AI) {
      const streamUrlCheck = resolveRequiredBaseUrl({
        envName: 'FRONTDESK_REALTIME_WS_BASE_URL',
        value:
          process.env.PUBLIC_REALTIME_WS_BASE_URL ??
          process.env.FRONTDESK_REALTIME_WS_BASE_URL,
        allowedProtocols: ['ws:', 'wss:']
      });
      const apiPublicUrlCheck = resolveRequiredBaseUrl({
        envName: 'FRONTDESK_API_PUBLIC_URL',
        value: process.env.FRONTDESK_API_PUBLIC_URL,
        allowedProtocols: ['http:', 'https:']
      });

      if (!streamUrlCheck.ok || !apiPublicUrlCheck.ok) {
        const fallbackReason = !streamUrlCheck.ok ? streamUrlCheck.reason : apiPublicUrlCheck.reason;
        app.log.error({
          msg: 'AI voice fallback returned from inbound webhook',
          twilioCallSid,
          callId: call.id,
          fallbackReason
        });
        await createCallEventWithRetry({
          callId: call.id,
          type: 'twilio.inbound.fallback',
          payloadJson: {
            reason: fallbackReason,
            routeKind: route.routeKind
          }
        });
        return reply.send(twimlSayAndHangup(AI_LINE_UNAVAILABLE_MESSAGE));
      }

      const readiness = await checkRealtimeGatewayReadiness(streamUrlCheck.value);
      if (!readiness.ok) {
        app.log.error({
          msg: 'AI voice fallback returned from inbound webhook',
          twilioCallSid,
          callId: call.id,
          fallbackReason: readiness.reason,
          realtimeHealthUrl: readiness.healthUrl,
          realtimeWsProbeUrl: readiness.wsProbeUrl
        });

        await createCallEventWithRetry({
          callId: call.id,
          type: 'twilio.inbound.fallback',
          payloadJson: {
            reason: readiness.reason,
            routeKind: route.routeKind,
            realtimeHealthUrl: readiness.healthUrl,
            realtimeWsProbeUrl: readiness.wsProbeUrl
          }
        });

        return reply.send(twimlSayAndHangup(AI_LINE_UNAVAILABLE_MESSAGE));
      }

      const internalSecret = process.env.FRONTDESK_INTERNAL_API_SECRET ?? null;
      const authSignature = buildMediaStreamAuthSignature({
        callSid: twilioCallSid,
        phoneNumberId: call.phoneNumberId,
        tenantId: phoneNumber.tenantId,
        businessId: phoneNumber.businessId,
        agentProfileId: call.agentProfileId ?? null,
        internalSecret
      });
      const recordingStatusCallbackUrl = `${apiPublicUrlCheck.value}/v1/twilio/voice/recording-status`;

      return reply.send(
        twimlConnectStream({
          streamBaseUrl: streamUrlCheck.value,
          callSid: twilioCallSid,
          phoneNumberId: call.phoneNumberId,
          tenantId: phoneNumber.tenantId,
          businessId: phoneNumber.businessId,
          agentProfileId: call.agentProfileId ?? null,
          authSignature,
          recordingStatusCallbackUrl
        })
      );
    }

    return reply.send(twimlSayAndHangup(route.message));
  });
}
