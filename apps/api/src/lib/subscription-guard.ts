import type { FastifyReply, FastifyRequest } from 'fastify';
import { getSubscriptionByTenantId } from './subscription-store.js';
import { getTenantTrialState } from './tenant-trial.js';

declare module 'fastify' {
  interface FastifyRequest {
    subscriptionWarning?: string;
  }
}

function forbiddenSubscriptionRequired(reply: FastifyReply) {
  reply.code(403).send({
    error: 'Active subscription required.',
    redirectTo: '/billing'
  });
}

export async function requireActiveSubscription(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.tenantId;

  if (!tenantId) {
    forbiddenSubscriptionRequired(reply);
    return false;
  }

  const subscription = await getSubscriptionByTenantId(tenantId);
  const status = subscription?.status.toLowerCase();

  if (status === 'active' || status === 'trialing') {
    return true;
  }

  if (status === 'past_due') {
    request.subscriptionWarning = 'past_due';
    return true;
  }

  if (!subscription) {
    const trialState = await getTenantTrialState(tenantId);

    if (trialState?.isTrialActive) {
      return true;
    }
  }

  forbiddenSubscriptionRequired(reply);
  return false;
}
