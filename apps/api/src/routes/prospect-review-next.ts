import type { FastifyInstance } from 'fastify';
import {
  getRequiredProspectScopeError,
  normalizeProspectScopeQuery
} from '../lib/prospect-selectors.js';
import { reviewNextScopedProspect, type RequiredProspectScope } from '../lib/prospect-workflow.js';

export async function registerProspectReviewNextRoutes(app: FastifyInstance) {
  app.get('/v1/prospects/review-next', async (request, reply) => {
    const query = request.query as {
      tenantId?: string;
      businessId?: string;
      excludeProspectSid?: string | string[];
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

    const rawExcludeProspectSid = query.excludeProspectSid;
    const excludeProspectSids = (Array.isArray(rawExcludeProspectSid) ? rawExcludeProspectSid : [rawExcludeProspectSid])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return {
      ok: true,
      prospectSid: await reviewNextScopedProspect(requiredScope, excludeProspectSids)
    };
  });
}
