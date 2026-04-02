import type { FrontdeskBusinessHours } from './frontdesk-session-context';

export type FrontdeskRoutingMode =
  | 'AI_ALWAYS'
  | 'AI_AFTER_HOURS'
  | 'HUMAN_ONLY'
  | 'AI_OVERFLOW';

export type FrontdeskRouteKind = 'AI' | 'HUMAN';

export type FrontdeskRoutingReason =
  | 'AI_ALWAYS'
  | 'AI_AFTER_HOURS_OPEN'
  | 'AI_AFTER_HOURS_CLOSED'
  | 'HUMAN_ONLY'
  | 'AI_OVERFLOW';

export type FrontdeskInboundRoutingPolicyInput = {
  timezone: string | null;
  businessHours: FrontdeskBusinessHours[];
  routingMode: FrontdeskRoutingMode;
  primaryAgentProfileId: string | null;
  afterHoursAgentProfileId: string | null;
  now?: Date;
};

export type FrontdeskInboundRoutingPolicyResult = {
  isOpen: boolean;
  routeKind: FrontdeskRouteKind;
  agentProfileId: string | null;
  reason: FrontdeskRoutingReason;
  message: string;
};

function getLocalWeekdayAndTime(timezone: string, now: Date) {
  const weekdayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long'
  }).formatToParts(now);

  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);

  const weekday = weekdayParts.find((part) => part.type === 'weekday')?.value ?? 'Monday';
  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '00';

  const weekdayMap: Record<string, FrontdeskBusinessHours['weekday']> = {
    Monday: 'MONDAY',
    Tuesday: 'TUESDAY',
    Wednesday: 'WEDNESDAY',
    Thursday: 'THURSDAY',
    Friday: 'FRIDAY',
    Saturday: 'SATURDAY',
    Sunday: 'SUNDAY'
  };

  return {
    weekday: weekdayMap[weekday] ?? 'MONDAY',
    localTime: `${hour}:${minute}`
  };
}

export function isFrontdeskBusinessOpen(input: {
  timezone: string | null;
  businessHours: FrontdeskBusinessHours[];
  now?: Date;
}) {
  if (!input.timezone) {
    return false;
  }

  const { weekday, localTime } = getLocalWeekdayAndTime(input.timezone, input.now ?? new Date());
  const today = input.businessHours.find((row) => row.weekday === weekday);

  if (!today) {
    return false;
  }

  if (today.isClosed) {
    return false;
  }

  if (!today.openTime || !today.closeTime) {
    return false;
  }

  return localTime >= today.openTime && localTime < today.closeTime;
}

export function resolveFrontdeskInboundRoutingPolicy(
  input: FrontdeskInboundRoutingPolicyInput
): FrontdeskInboundRoutingPolicyResult {
  const isOpen = isFrontdeskBusinessOpen({
    timezone: input.timezone,
    businessHours: input.businessHours,
    now: input.now
  });

  if (input.routingMode === 'AI_ALWAYS') {
    return {
      isOpen,
      routeKind: 'AI',
      agentProfileId: input.primaryAgentProfileId ?? input.afterHoursAgentProfileId ?? null,
      reason: 'AI_ALWAYS',
      message: 'Connecting to AI front desk'
    };
  }

  if (input.routingMode === 'AI_AFTER_HOURS') {
    if (isOpen) {
      return {
        isOpen,
        routeKind: 'AI',
        agentProfileId: input.primaryAgentProfileId ?? null,
        reason: 'AI_AFTER_HOURS_OPEN',
        message: 'Connecting to main AI front desk'
      };
    }

    return {
      isOpen,
      routeKind: 'AI',
      agentProfileId: input.afterHoursAgentProfileId ?? input.primaryAgentProfileId ?? null,
      reason: 'AI_AFTER_HOURS_CLOSED',
      message: 'Connecting to after-hours AI front desk'
    };
  }

  if (input.routingMode === 'HUMAN_ONLY') {
    return {
      isOpen,
      routeKind: 'HUMAN',
      agentProfileId: null,
      reason: 'HUMAN_ONLY',
      message: 'Thanks for calling. Our team is not yet connected in this environment. Please call back shortly.'
    };
  }

  return {
    isOpen,
    routeKind: 'HUMAN',
    agentProfileId: input.primaryAgentProfileId ?? null,
    reason: 'AI_OVERFLOW',
    message: 'Thanks for calling. Overflow routing is not yet connected in this environment.'
  };
}
