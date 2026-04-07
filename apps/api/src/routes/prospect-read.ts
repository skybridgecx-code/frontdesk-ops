import type { FastifyInstance } from 'fastify';
import { ProspectStatus, prisma } from '@frontdesk/db';
import { z } from 'zod';
import { businessIdParams, prospectParams } from '../lib/params.js';
import { getProspectReadSignals } from '@frontdesk/domain';

const prospectReadQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    status: z.nativeEnum(ProspectStatus).optional()
  })
  .strict();

const DEFAULT_PROSPECT_LIST_LIMIT = 200;

export async function registerProspectReadRoutes(app: FastifyInstance) {
  app.get('/v1/businesses/:businessId/prospects', async (request, reply) => {
    const { businessId } = businessIdParams.parse(request.params);
    const parsed = prospectReadQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const prospects = await prisma.prospect.findMany({
      where: {
        businessId,
        ...(parsed.data.status ? { status: parsed.data.status } : {})
      },
      orderBy: [
        {
          nextActionAt: {
            sort: 'asc',
            nulls: 'last'
          }
        },
        {
          createdAt: 'desc'
        }
      ],
      take: parsed.data.limit ?? DEFAULT_PROSPECT_LIST_LIMIT,
      select: {
        prospectSid: true,
        companyName: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        city: true,
        state: true,
        sourceLabel: true,
        serviceInterest: true,
        status: true,
        priority: true,
        lastAttemptAt: true,
        nextActionAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      prospects: prospects.map((prospect) => ({
        ...prospect,
        readState: getProspectReadSignals({
          status: prospect.status,
          nextActionAt: prospect.nextActionAt,
          lastAttemptAt: prospect.lastAttemptAt
        })
      }))
    };
  });

  app.get('/v1/businesses/:businessId/prospects/:prospectSid', async (request, reply) => {
        const { businessId, prospectSid } = prospectParams.parse(request.params);

    const prospect = await prisma.prospect.findFirst({
      where: {
        businessId,
        prospectSid
      },
      select: {
        prospectSid: true,
        companyName: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        city: true,
        state: true,
        sourceLabel: true,
        serviceInterest: true,
        status: true,
        priority: true,
        lastAttemptAt: true,
        notes: true,
        nextActionAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!prospect) {
      return reply.notFound(`Prospect not found for businessId=${businessId} prospectSid=${prospectSid}`);
    }

    return {
      ok: true,
      prospect: {
        ...prospect,
        readState: getProspectReadSignals({
          status: prospect.status,
          nextActionAt: prospect.nextActionAt,
          lastAttemptAt: prospect.lastAttemptAt
        })
      }
    };
  });
}
