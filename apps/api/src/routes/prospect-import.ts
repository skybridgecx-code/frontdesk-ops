import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProspectPriority, ProspectStatus } from '@frontdesk/db';
import { BusinessNotFoundError, importProspectsForBusiness } from '../lib/prospect-import.js';

const importProspectItemSchema = z
  .object({
    companyName: z.string().min(1).max(160),
    contactName: z.string().min(1).max(160).nullable().optional(),
    contactPhone: z.string().min(1).max(40).nullable().optional(),
    contactEmail: z.string().email().max(160).nullable().optional(),
    city: z.string().min(1).max(120).nullable().optional(),
    state: z.string().min(1).max(80).nullable().optional(),
    sourceLabel: z.string().min(1).max(120).nullable().optional(),
    serviceInterest: z.string().min(1).max(240).nullable().optional(),
    notes: z.string().min(1).max(4000).nullable().optional(),
    status: z.nativeEnum(ProspectStatus).optional(),
    priority: z.nativeEnum(ProspectPriority).nullable().optional(),
    nextActionAt: z.coerce.date().nullable().optional()
  })
  .strict();

const importProspectsBodySchema = z
  .object({
    prospects: z.array(importProspectItemSchema).min(1).max(100),
    defaultSourceLabel: z.string().min(1).max(120).optional()
  })
  .strict();

function trimImportValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(trimImportValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, trimImportValue(nestedValue)])
    );
  }

  return value;
}

export async function registerProspectImportRoutes(app: FastifyInstance) {
  app.post('/v1/businesses/:businessId/prospects/import', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const parsed = importProspectsBodySchema.safeParse(trimImportValue(request.body));

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    try {
      const result = await importProspectsForBusiness({
        businessId,
        defaultSourceLabel: parsed.data.defaultSourceLabel,
        prospects: parsed.data.prospects
      });

      return {
        ok: true,
        importedCount: result.importedCount,
        prospects: result.prospects
      };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        return reply.notFound(error.message);
      }

      throw error;
    }
  });
}
