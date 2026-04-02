import type { FastifyInstance } from 'fastify';
import { prisma, CallDirection, CallRouteKind, CallStatus, Prisma } from '@frontdesk/db';
import { resolveFrontdeskInboundRoutingPolicy } from '@frontdesk/domain';
import { FRONTDESK_ROUTE_DECISION_EVENT_TYPE } from '../lib/call-routing-decision.js';

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

    const route = resolveFrontdeskInboundRoutingPolicy({
      timezone: phoneNumber.business.timezone,
      businessHours: phoneNumber.business.businessHours,
      routingMode: phoneNumber.routingMode,
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

    await prisma.callEvent.createMany({
      data: [
        {
          callId: call.id,
          type: 'twilio.inbound.received',
          sequence: existingEventCount + 1,
          payloadJson: body as Prisma.InputJsonValue
        },
        {
          callId: call.id,
          type: FRONTDESK_ROUTE_DECISION_EVENT_TYPE,
          sequence: existingEventCount + 2,
          payloadJson: {
            routingMode: phoneNumber.routingMode,
            isOpen: route.isOpen,
            routeKind: route.routeKind,
            agentProfileId: route.agentProfileId,
            reason: route.reason,
            message: route.message,
            phoneLineLabel: phoneNumber.label,
            businessTimezone: phoneNumber.business.timezone
          } as Prisma.InputJsonValue
        }
      ]
    });

    reply.header('Content-Type', 'text/xml; charset=utf-8');

    if (route.routeKind === CallRouteKind.AI) {
      const streamBaseUrl =
        process.env.PUBLIC_REALTIME_WS_BASE_URL ??
        process.env.FRONTDESK_REALTIME_WS_BASE_URL ?? 'ws://127.0.0.1:4001/ws/media-stream';

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
