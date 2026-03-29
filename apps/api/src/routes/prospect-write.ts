import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ProspectAttemptChannel,
  ProspectAttemptOutcome,
  ProspectPriority,
  ProspectStatus
} from '@frontdesk/db';
import {
  getRequiredProspectScopeError,
  normalizeProspectScopeQuery
} from '../lib/prospect-selectors.js';
import {
  ArchivedProspectAttemptError,
  archiveScopedProspect,
  logScopedProspectAttempt,
  ProspectNotFoundError,
  type RequiredProspectScope,
  updateScopedProspectFacts
} from '../lib/prospect-workflow.js';

const updateProspectBodySchema = z
  .object({
    companyName: z.string().min(1).max(160).optional(),
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

const logProspectAttemptBodySchema = z
  .object({
    channel: z.nativeEnum(ProspectAttemptChannel),
    outcome: z.nativeEnum(ProspectAttemptOutcome),
    note: z.string().min(1).max(4000).nullable().optional()
  })
  .strict();

export async function registerProspectWriteRoutes(app: FastifyInstance) {
  app.patch('/v1/prospects/:prospectSid', async (request, reply) => {
    const { prospectSid } = request.params as { prospectSid: string };
    const scope = normalizeProspectScopeQuery(request.query as { tenantId?: string; businessId?: string });
    const scopeError = getRequiredProspectScopeError(scope);
    const parsed = updateProspectBodySchema.safeParse(request.body);

    if (scopeError) {
      return reply.status(400).send({
        ok: false,
        error: scopeError
      });
    }

    const requiredScope: RequiredProspectScope = {
      tenantId: scope.tenantId!,
      businessId: scope.businessId!
    };

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

    try {
      const prospect = await updateScopedProspectFacts(requiredScope, prospectSid, parsed.data);

      return {
        ok: true,
        prospect
      };
    } catch (error) {
      if (error instanceof ProspectNotFoundError) {
        return reply.notFound(error.message);
      }

      throw error;
    }
  });

  app.post('/v1/prospects/:prospectSid/log-attempt', async (request, reply) => {
    const { prospectSid } = request.params as { prospectSid: string };
    const scope = normalizeProspectScopeQuery(request.query as { tenantId?: string; businessId?: string });
    const scopeError = getRequiredProspectScopeError(scope);
    const parsed = logProspectAttemptBodySchema.safeParse(request.body);

    if (scopeError) {
      return reply.status(400).send({
        ok: false,
        error: scopeError
      });
    }

    const requiredScope: RequiredProspectScope = {
      tenantId: scope.tenantId!,
      businessId: scope.businessId!
    };

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    try {
      const prospect = await logScopedProspectAttempt(requiredScope, prospectSid, parsed.data);

      return {
        ok: true,
        prospect
      };
    } catch (error) {
      if (error instanceof ProspectNotFoundError) {
        return reply.notFound(error.message);
      }

      if (error instanceof ArchivedProspectAttemptError) {
        return reply.status(400).send({
          ok: false,
          error: error.message
        });
      }

      throw error;
    }
  });

  app.post('/v1/prospects/:prospectSid/archive', async (request, reply) => {
    const { prospectSid } = request.params as { prospectSid: string };
    const scope = normalizeProspectScopeQuery(request.query as { tenantId?: string; businessId?: string });
    const scopeError = getRequiredProspectScopeError(scope);

    if (scopeError) {
      return reply.status(400).send({
        ok: false,
        error: scopeError
      });
    }

    const requiredScope: RequiredProspectScope = {
      tenantId: scope.tenantId!,
      businessId: scope.businessId!
    };

    try {
      const prospect = await archiveScopedProspect(requiredScope, prospectSid);

      return {
        ok: true,
        prospect
      };
    } catch (error) {
      if (error instanceof ProspectNotFoundError) {
        return reply.notFound(error.message);
      }

      throw error;
    }
  });
}
