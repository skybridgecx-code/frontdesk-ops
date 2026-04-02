export const FRONTDESK_ROUTE_DECISION_EVENT_TYPE = 'frontdesk.route.decision';

export type CallRoutingDecisionPayload = {
  routingMode?: string;
  isOpen?: boolean;
  routeKind?: string;
  agentProfileId?: string | null;
  reason?: string;
  message?: string;
  phoneLineLabel?: string | null;
  businessTimezone?: string | null;
};

export type CallRoutingDecision = {
  routingMode: string | null;
  isOpen: boolean | null;
  routeKind: string | null;
  agentProfileId: string | null;
  reason: string | null;
  message: string | null;
  phoneLineLabel: string | null;
  businessTimezone: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

export function parseCallRoutingDecisionPayload(value: unknown): CallRoutingDecision | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    routingMode: getString(value.routingMode),
    isOpen: getBoolean(value.isOpen),
    routeKind: getString(value.routeKind),
    agentProfileId:
      value.agentProfileId === null ? null : getString(value.agentProfileId),
    reason: getString(value.reason),
    message: getString(value.message),
    phoneLineLabel:
      value.phoneLineLabel === null ? null : getString(value.phoneLineLabel),
    businessTimezone:
      value.businessTimezone === null ? null : getString(value.businessTimezone)
  };
}

export function getLatestCallRoutingDecision(
  events: Array<{
    type: string;
    payloadJson?: unknown;
  }>
) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) {
      continue;
    }

    if (event.type !== FRONTDESK_ROUTE_DECISION_EVENT_TYPE) {
      continue;
    }

    const parsed = parseCallRoutingDecisionPayload(event.payloadJson);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
