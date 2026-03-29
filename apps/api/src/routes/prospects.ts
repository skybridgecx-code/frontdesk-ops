import type { FastifyInstance } from 'fastify';
import { buildFrontdeskProspectActionGuide } from '@frontdesk/domain';
import { getRequiredProspectScopeError, normalizeProspectScopeQuery } from '../lib/prospect-selectors.js';
import {
  type RequiredProspectScope,
  getScopedProspectDetail,
  listScopedProspects,
  summarizeScopedProspects
} from '../lib/prospect-workflow.js';

type ProspectTimelineAttempt = {
  channel: string;
  outcome: string;
  note: string | null;
  attemptedAt: Date | string;
};

type ProspectOperatorTimelineInput = {
  createdAt: Date | string;
  sourceLabel: string | null;
  respondedAt: Date | string | null;
  archivedAt: Date | string | null;
  attempts: ProspectTimelineAttempt[];
};

export type ProspectOperatorTimelineItem = {
  type: string;
  occurredAt: string;
  title: string;
  description: string;
  actorLabel: string | null;
  statusLabel: string | null;
};

function formatTimelineLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, (match) => match.toUpperCase());
}

function formatTimelineSourceLabel(value: string | null) {
  if (!value) {
    return null;
  }

  if (value === 'public_demo_request') {
    return 'Demo request';
  }

  return formatTimelineLabel(value);
}

function toTimelineInstant(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function pushTimelineItem(
  items: ProspectOperatorTimelineItem[],
  item: Omit<ProspectOperatorTimelineItem, 'occurredAt'> & { occurredAt: string | null }
) {
  if (!item.occurredAt) {
    return;
  }

  items.push({
    ...item,
    occurredAt: item.occurredAt
  });
}

export function buildProspectOperatorTimeline(input: ProspectOperatorTimelineInput) {
  const items: ProspectOperatorTimelineItem[] = [];
  const sourceLabel = formatTimelineSourceLabel(input.sourceLabel);

  pushTimelineItem(items, {
    type: 'prospect.created',
    occurredAt: toTimelineInstant(input.createdAt),
    title: 'Prospect added to outbound work',
    description: sourceLabel ? `Added from ${sourceLabel}.` : 'Added to the outbound work queue.',
    actorLabel: sourceLabel,
    statusLabel: null
  });

  for (const attempt of input.attempts) {
    const channelLabel = formatTimelineLabel(attempt.channel);
    const outcomeLabel = formatTimelineLabel(attempt.outcome);
    const detail = [channelLabel, outcomeLabel].filter(Boolean).join(' · ');
    const description = attempt.note ? `${detail} — ${attempt.note}` : detail || 'Operator outreach activity recorded.';
    const isReplyOutcome = attempt.outcome.toUpperCase().includes('REPLY');

    pushTimelineItem(items, {
      type: 'prospect.attempt',
      occurredAt: toTimelineInstant(attempt.attemptedAt),
      title: isReplyOutcome ? 'Reply logged' : 'Outreach attempt logged',
      description,
      actorLabel: 'Operator',
      statusLabel: isReplyOutcome ? 'Responded' : 'Attempted'
    });
  }

  pushTimelineItem(items, {
    type: 'prospect.responded',
    occurredAt: toTimelineInstant(input.respondedAt),
    title: 'Prospect responded',
    description: 'A response was recorded and the prospect moved into reply handling.',
    actorLabel: 'Prospect',
    statusLabel: 'Responded'
  });

  pushTimelineItem(items, {
    type: 'prospect.archived',
    occurredAt: toTimelineInstant(input.archivedAt),
    title: 'Prospect archived',
    description: 'This prospect was archived and removed from active outbound work.',
    actorLabel: 'Operator',
    statusLabel: 'Archived'
  });

  return items.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

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
    const timeline = buildProspectOperatorTimeline({
      createdAt: prospect.createdAt,
      sourceLabel: prospect.sourceLabel,
      respondedAt: prospect.respondedAt,
      archivedAt: prospect.archivedAt,
      attempts: prospect.attempts
    });

    return {
      ok: true,
      prospect: {
        ...prospect,
        actionGuide,
        timeline
      }
    };
  });
}
