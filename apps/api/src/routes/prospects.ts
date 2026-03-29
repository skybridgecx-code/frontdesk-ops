import type { FastifyInstance } from 'fastify';
import { buildFrontdeskProspectActionGuide } from '@frontdesk/domain';
import { getRequiredProspectScopeError, normalizeProspectScopeQuery } from '../lib/prospect-selectors.js';
import {
  type RequiredProspectScope,
  getScopedProspectDetail,
  listScopedProspects,
  summarizeScopedProspects
} from '../lib/prospect-workflow.js';

export async function registerProspectRoutes(app: FastifyInstance) {
  app.get('/v1/prospects', async (request, reply) => {
    const query = request.query as {
      tenantId?: string;
      businessId?: string;
      limit?: string;
      page?: string;
      status?: string;
      priority?: string;
      q?: string;
    };
    const scope = normalizeProspectScopeQuery(query);
    const scopeError = getRequiredProspectScopeError(scope);

    if (scopeError) {
      return reply.status(400).send({
        ok: false,
        error: scopeError
      });
    }

    const requiredScope: RequiredProspectScope = {
      tenantId: scope.tenantId!,
      businessId: scope.businessId!,
      status: scope.status,
      priority: scope.priority,
      q: scope.q
    };

    const result = await listScopedProspects(requiredScope, {
      page: query.page,
      limit: query.limit
    });

    return {
      ok: true,
      ...result
    };
  });

  app.get('/v1/prospects/summary', async (request, reply) => {
    const query = request.query as {
      tenantId?: string;
      businessId?: string;
      status?: string;
      priority?: string;
      q?: string;
    };
    const scope = normalizeProspectScopeQuery(query);
    const scopeError = getRequiredProspectScopeError(scope);

    if (scopeError) {
      return reply.status(400).send({
        ok: false,
        error: scopeError
      });
    }

    return {
      ok: true,
      ...(await summarizeScopedProspects({
        tenantId: scope.tenantId!,
        businessId: scope.businessId!,
        status: scope.status,
        priority: scope.priority,
        q: scope.q
      }))
    };
  });

  app.get('/v1/prospects/:prospectSid', async (request, reply) => {
    const { prospectSid } = request.params as { prospectSid: string };
    const query = request.query as {
      tenantId?: string;
      businessId?: string;
      status?: string;
      priority?: string;
      q?: string;
    };
    const scope = normalizeProspectScopeQuery(query);
    const scopeError = getRequiredProspectScopeError(scope);

    if (scopeError) {
      return reply.status(400).send({
        ok: false,
        error: scopeError
      });
    }

    const prospect = await getScopedProspectDetail(
      {
        tenantId: scope.tenantId!,
        businessId: scope.businessId!,
        status: scope.status,
        priority: scope.priority,
        q: scope.q
      },
      prospectSid
    );

    if (!prospect) {
      return reply.notFound(`Prospect not found for prospectSid=${prospectSid}`);
    }

    const actionGuide = buildFrontdeskProspectActionGuide({
      status: prospect.status,
      priority: prospect.priority,
      nextActionAt: prospect.nextActionAt,
      lastAttemptAt: prospect.lastAttemptAt,
      respondedAt: prospect.respondedAt,
      archivedAt: prospect.archivedAt,
      contactPhone: prospect.contactPhone,
      contactEmail: prospect.contactEmail,
      contactName: prospect.contactName,
      companyName: prospect.companyName,
      serviceInterest: prospect.serviceInterest,
      notes: prospect.notes,
      sourceLabel: prospect.sourceLabel,
      sourceCategory: prospect.sourceCategory,
      sourceRoleTitle: prospect.sourceRoleTitle,
      attempts: prospect.attempts
    });

    return {
      ok: true,
      prospect: {
        ...prospect,
        actionGuide
      }
    };
  });
}
