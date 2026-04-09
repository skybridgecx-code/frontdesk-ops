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

import type { FastifyInstance } from 'fastify';
import { prisma, CallDirection, CallRouteKind, CallStatus, PhoneRoutingMode, Weekday } from '@frontdesk/db';
import { requireTwilioSignature } from '../lib/twilio-validation.js';
import { enforceUsageLimits } from '../lib/usage-limiter.js';

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

/**
 * Returns TwiML that connects the call to a media stream WebSocket.
 *
 * The stream URL includes query params that the realtime gateway uses
 * to look up the call, phone number, and agent profile. The internal
 * secret is passed as a `token` param for WebSocket authentication.
 */
function twimlConnectStream(input: {
  streamBaseUrl: string;
  callSid: string;
  phoneNumberId: string;
  agentProfileId: string | null;
  internalSecret: string | null;
  recordingStatusCallbackUrl: string;
}) {
  const base = input.streamBaseUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    callSid: input.callSid,
    phoneNumberId: input.phoneNumberId,
    agentProfileId: input.agentProfileId ?? ''
  });
  if (input.internalSecret) {
    params.set('token', input.internalSecret);
  }
  const url = `${base}?${params.toString()}`;

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect record="record-from-answer-dual" recordingStatusCallback="${escapeXml(input.recordingStatusCallbackUrl)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed absent"><Stream url="${escapeXml(url)}" /></Connect></Response>`;
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

    const twilioCallSid = body.CallSid ?? '';
    const fromE164 = body.From ?? null;
    const toE164 = body.To ?? null;

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

    for (let attempt = 0; attempt < 3; attempt++) {
      const existingEventCount = await prisma.callEvent.count({
        where: { callId: call.id }
      });
      try {
        await prisma.callEvent.create({
          data: {
            callId: call.id,
            type: 'twilio.inbound.received',
            sequence: existingEventCount + 1,
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

    reply.header('Content-Type', 'text/xml; charset=utf-8');

    if (route.routeKind === CallRouteKind.AI) {
      const streamBaseUrl =
        process.env.PUBLIC_REALTIME_WS_BASE_URL ??
        process.env.FRONTDESK_REALTIME_WS_BASE_URL ?? 'ws://127.0.0.1:4001/ws/media-stream';

      const internalSecret = process.env.FRONTDESK_INTERNAL_API_SECRET ?? null;
      const apiPublicBaseUrl = process.env.FRONTDESK_API_PUBLIC_URL ?? 'http://localhost:4000';
      const recordingStatusCallbackUrl = `${apiPublicBaseUrl.replace(/\/$/, '')}/v1/twilio/voice/recording-status`;

      return reply.send(
        twimlConnectStream({
          streamBaseUrl,
          callSid: twilioCallSid,
          phoneNumberId: call.phoneNumberId,
          agentProfileId: call.agentProfileId ?? null,
          internalSecret,
          recordingStatusCallbackUrl
        })
      );
    }

    return reply.send(twimlSayAndHangup(route.message));
  });
}
