import type { FastifyInstance } from 'fastify';
import { ProspectStatus, prisma } from '@frontdesk/db';
import { z } from 'zod';

const prospectReadQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    status: z.nativeEnum(ProspectStatus).optional()
  })
  .strict();

export async function registerProspectReadRoutes(app: FastifyInstance) {
  app.get('/v1/businesses/:businessId/prospects', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };

    const parsed = prospectReadQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const prospects = parsed.data.status
      ? await prisma.$queryRaw`
          SELECT
            "prospectSid",
            "companyName",
            "contactName",
            "contactPhone",
            "contactEmail",
            "city",
            "state",
            "sourceLabel",
            "status",
            "priority",
            "lastAttemptAt",
            "nextActionAt",
            "createdAt",
            "updatedAt"
          FROM "Prospect"
          WHERE "businessId" = ${businessId}
            AND "status" = ${parsed.data.status}
          ORDER BY
            CASE
              WHEN "nextActionAt" IS NOT NULL AND "nextActionAt" <= NOW() THEN 0
              WHEN "nextActionAt" IS NOT NULL THEN 1
              ELSE 2
            END,
            CASE WHEN "nextActionAt" IS NOT NULL THEN "nextActionAt" END ASC,
            "createdAt" DESC
          LIMIT ${parsed.data.limit ?? 50}
        `
      : await prisma.$queryRaw`
          SELECT
            "prospectSid",
            "companyName",
            "contactName",
            "contactPhone",
            "contactEmail",
            "city",
            "state",
            "sourceLabel",
            "status",
            "priority",
            "lastAttemptAt",
            "nextActionAt",
            "createdAt",
            "updatedAt"
          FROM "Prospect"
          WHERE "businessId" = ${businessId}
          ORDER BY
            CASE
              WHEN "nextActionAt" IS NOT NULL AND "nextActionAt" <= NOW() THEN 0
              WHEN "nextActionAt" IS NOT NULL THEN 1
              ELSE 2
            END,
            CASE WHEN "nextActionAt" IS NOT NULL THEN "nextActionAt" END ASC,
            "createdAt" DESC
          LIMIT ${parsed.data.limit ?? 50}
        `;

    return {
      ok: true,
      prospects
    };
  });

  app.get('/v1/businesses/:businessId/prospects/:prospectSid', async (request, reply) => {
    const { businessId, prospectSid } = request.params as {
      businessId: string;
      prospectSid: string;
    };

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
        status: true,
        priority: true,
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
      prospect
    };
  });
}
