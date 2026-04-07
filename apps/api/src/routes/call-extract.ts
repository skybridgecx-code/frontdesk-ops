import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { extractCallData } from '@frontdesk/integrations/call-extraction';
import { callSidParams } from '../lib/params.js';

export async function registerCallExtractionRoutes(app: FastifyInstance) {
  app.post('/v1/calls/:callSid/extract', async (request, reply) => {
        const { callSid } = callSidParams.parse(request.params);

    const call = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
      select: {
        id: true,
        twilioCallSid: true,
        callerTranscript: true,
        assistantTranscript: true
      }
    });

    if (!call) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    if (!call.callerTranscript && !call.assistantTranscript) {
      return reply.status(400).send({
        ok: false,
        error: 'Call has no transcript content to extract from'
      });
    }

    const extracted = await extractCallData({
      callerTranscript: call.callerTranscript,
      assistantTranscript: call.assistantTranscript
    });

    const updatedCall = await prisma.call.update({
      where: { id: call.id },
      data: {
        leadName: extracted.leadName,
        leadPhone: extracted.leadPhone,
        leadIntent: extracted.leadIntent,
        urgency: extracted.urgency,
        serviceAddress: extracted.serviceAddress,
        summary: extracted.summary
      },
      select: {
        twilioCallSid: true,
        leadName: true,
        leadPhone: true,
        leadIntent: true,
        urgency: true,
        serviceAddress: true,
        summary: true
      }
    });

    return {
      ok: true,
      call: updatedCall
    };
  });
}
