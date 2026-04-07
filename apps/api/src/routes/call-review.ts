import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, CallReviewStatus } from '@frontdesk/db';
import { callSidParams } from '../lib/params.js';

const updateCallBodySchema = z
  .object({
    leadName: z.string().min(1).max(160).nullable().optional(),
    leadPhone: z.string().min(1).max(40).nullable().optional(),
    leadIntent: z.string().min(1).max(200).nullable().optional(),
    urgency: z.enum(['low', 'medium', 'high', 'emergency']).nullable().optional(),
    serviceAddress: z.string().min(1).max(240).nullable().optional(),
    summary: z.string().min(1).max(4000).nullable().optional(),
    operatorNotes: z.string().min(1).max(4000).nullable().optional(),
    reviewStatus: z.nativeEnum(CallReviewStatus).optional()
  })
  .strict();

// PATCH /v1/calls/:callSid
export async function registerCallReviewRoutes(app: FastifyInstance) {
  app.patch('/v1/calls/:callSid', async (request, reply) => {
    const { callSid } = callSidParams.parse(request.params);
    const parsed = updateCallBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({
        ok: false,
        error: 'At least one field must be provided'
      });
    }

    const existing = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
      select: { id: true }
    });

    if (!existing) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    const shouldStampReviewedAt =
      parsed.data.reviewStatus === CallReviewStatus.REVIEWED ||
      parsed.data.reviewStatus === CallReviewStatus.NEEDS_REVIEW;

    const call = await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: {
        leadName: parsed.data.leadName,
        leadPhone: parsed.data.leadPhone,
        leadIntent: parsed.data.leadIntent,
        urgency: parsed.data.urgency,
        serviceAddress: parsed.data.serviceAddress,
        summary: parsed.data.summary,
        operatorNotes: parsed.data.operatorNotes,
        reviewStatus: parsed.data.reviewStatus,
        reviewedAt: shouldStampReviewedAt ? new Date() : undefined
      },
      select: {
        twilioCallSid: true,
        leadName: true,
        leadPhone: true,
        leadIntent: true,
        urgency: true,
        serviceAddress: true,
        summary: true,
        operatorNotes: true,
        reviewStatus: true,
        reviewedAt: true,
        triageStatus: true
      }
    });

    return {
      ok: true,
      call
    };
  });
}
