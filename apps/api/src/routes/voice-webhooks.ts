import type { FastifyInstance } from 'fastify';
import { prisma, CallDirection, CallRouteKind, CallStatus, PhoneRoutingMode, Weekday } from '@frontdesk/db';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function twimlSayAndHangup(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`;
}

function twimlConnectStream(input: {
  streamBaseUrl: string;
  callSid: string;
  phoneNumberId: string;
  agentProfileId: string | null;
}) {
  const base = input.streamBaseUrl.replace(/\/$/, '');
  const url = `${base}?callSid=${encodeURIComponent(input.callSid)}&phoneNumberId=${encodeURIComponent(input.phoneNumberId)}&agentProfileId=${encodeURIComponent(input.agentProfileId ?? '')}`;

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${escapeXml(url)}" /></Connect></Response>`;
}

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
  app.post('/v1/twilio/voice/inbound', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string | undefined>;

    const twilioCallSid = body.CallSid ?? '';
    const fromE164 = body.From ?? null;
    const toE164 = body.To ?? null;

    if (!twilioCallSid || !toE164) {
      reply.header('Content-Type', 'text/xml; charset=utf-8');
      return reply.status(400).send(
        twimlSayAndHangup('We could not process your call because required call data was missing.')
      );
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

    const existingEventCount = await prisma.callEvent.count({
      where: { callId: call.id }
    });

    await prisma.callEvent.create({
      data: {
        callId: call.id,
        type: 'twilio.inbound.received',
        sequence: existingEventCount + 1,
        payloadJson: body
      }
    });

    reply.header('Content-Type', 'text/xml; charset=utf-8');

    if (route.routeKind === CallRouteKind.AI) {
      const streamBaseUrl =
        process.env.PUBLIC_REALTIME_WS_BASE_URL ??
        'ws://127.0.0.1:4001/ws/media-stream';

      return reply.send(
        twimlConnectStream({
          streamBaseUrl,
          callSid: twilioCallSid,
          phoneNumberId: call.phoneNumberId,
          agentProfileId: call.agentProfileId ?? null
        })
      );
    }

    return reply.send(twimlSayAndHangup(route.message));
  });
}
