export type FrontdeskBusinessHours = {
  weekday: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export type FrontdeskServiceArea = {
  label: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export type FrontdeskSessionContextInput = {
  businessName: string | null;
  businessVertical: string | null;
  timezone: string | null;
  phoneNumberLabel: string | null;
  routingMode: string | null;
  agentName: string | null;
  agentSystemPrompt: string | null;
  businessHours: FrontdeskBusinessHours[];
  serviceAreas: FrontdeskServiceArea[];
  now?: Date;
};

export type FrontdeskSessionContext = {
  instructions: string;
  metadata: {
    businessName: string;
    businessVertical: string | null;
    timezone: string | null;
    hoursState: 'open' | 'closed' | 'unknown';
    serviceAreaCount: number;
    routingMode: string | null;
  };
};

const WEEKDAY_ORDER: FrontdeskBusinessHours['weekday'][] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

function cleanNullableString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function humanizeEnum(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTime(value: string | null) {
  if (!value) {
    return null;
  }

  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText ?? '0');

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 || 12;
  const normalizedMinutes = String(minutes).padStart(2, '0');
  return `${normalizedHours}:${normalizedMinutes} ${suffix}`;
}

function formatHoursLine(entry: FrontdeskBusinessHours) {
  const weekday = humanizeEnum(entry.weekday) ?? entry.weekday;

  if (entry.isClosed) {
    return `${weekday}: closed`;
  }

  if (entry.openTime && entry.closeTime) {
    return `${weekday}: ${formatTime(entry.openTime)} to ${formatTime(entry.closeTime)}`;
  }

  return `${weekday}: hours not fully configured`;
}

function getLocalBusinessClock(timezone: string | null, now: Date) {
  if (!timezone) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? null;
  const hourText = parts.find((part) => part.type === 'hour')?.value ?? null;
  const minuteText = parts.find((part) => part.type === 'minute')?.value ?? null;
  const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value ?? null;

  if (!weekday || !hourText || !minuteText || !dayPeriod) {
    return null;
  }

  const hour12 = Number(hourText);
  let hour24 = hour12 % 12;
  if (dayPeriod.toUpperCase() === 'PM') {
    hour24 += 12;
  }

  return {
    weekday,
    minutesSinceMidnight: hour24 * 60 + Number(minuteText),
    formatted: `${weekday} ${hourText}:${minuteText} ${dayPeriod}`,
    weekdayEnum: weekday.toUpperCase() as FrontdeskBusinessHours['weekday']
  };
}

function parseMinutesSinceMidnight(value: string | null) {
  if (!value) {
    return null;
  }

  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText ?? '0');

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function describeCurrentHours(
  businessHours: FrontdeskBusinessHours[],
  timezone: string | null,
  now: Date
) {
  if (businessHours.length === 0) {
    return {
      hoursState: 'unknown' as const,
      lines: [
        'Business hours are not configured. Do not promise immediate live availability or same-day handling unless the caller states they already have confirmation from the business.'
      ]
    };
  }

  const localClock = getLocalBusinessClock(timezone, now);

  if (!localClock) {
    return {
      hoursState: 'unknown' as const,
      lines: [
        'Business hours are configured, but timezone context is unavailable. Use the listed hours as guidance and avoid making time-specific promises.'
      ]
    };
  }

  const todayHours = businessHours.find((entry) => entry.weekday === localClock.weekdayEnum);

  if (!todayHours || todayHours.isClosed) {
    return {
      hoursState: 'closed' as const,
      lines: [
        `Current business time is ${localClock.formatted}${timezone ? ` (${timezone})` : ''}. The business appears closed right now. Collect the caller details and issue clearly without promising immediate live handling.`,
        ...businessHours.map(formatHoursLine)
      ]
    };
  }

  const openMinutes = parseMinutesSinceMidnight(todayHours.openTime);
  const closeMinutes = parseMinutesSinceMidnight(todayHours.closeTime);

  if (openMinutes === null || closeMinutes === null) {
    return {
      hoursState: 'unknown' as const,
      lines: [
        `Current business time is ${localClock.formatted}${timezone ? ` (${timezone})` : ''}. Today's hours are not fully configured, so do not promise immediate live handling.`,
        ...businessHours.map(formatHoursLine)
      ]
    };
  }

  if (
    localClock.minutesSinceMidnight < openMinutes ||
    localClock.minutesSinceMidnight > closeMinutes
  ) {
    return {
      hoursState: 'closed' as const,
      lines: [
        `Current business time is ${localClock.formatted}${timezone ? ` (${timezone})` : ''}. The business appears closed right now based on configured hours. Collect details for follow-up instead of promising immediate live handling.`,
        ...businessHours.map(formatHoursLine)
      ]
    };
  }

  return {
    hoursState: 'open' as const,
    lines: [
      `Current business time is ${localClock.formatted}${timezone ? ` (${timezone})` : ''}. The business appears open right now based on configured hours, but do not promise dispatch timing unless it is explicitly confirmed.`,
      ...businessHours.map(formatHoursLine)
    ]
  };
}

function describeServiceAreas(serviceAreas: FrontdeskServiceArea[]) {
  if (serviceAreas.length === 0) {
    return 'Service areas are not configured. Capture the caller location and do not claim coverage certainty.';
  }

  const areaSummary = serviceAreas
    .slice(0, 6)
    .map((area) => {
      const label = cleanNullableString(area.label);
      const location = [cleanNullableString(area.city), cleanNullableString(area.state)]
        .filter(Boolean)
        .join(', ');

      return label ?? location ?? cleanNullableString(area.postalCode) ?? 'Unnamed area';
    })
    .join('; ');

  return `Known service-area guidance: ${areaSummary}. Treat this as guidance only. If caller location is unclear or outside these areas, capture the exact location and do not promise coverage until confirmed.`;
}

function describePhoneLine(input: {
  phoneNumberLabel: string | null;
  routingMode: string | null;
  agentName: string | null;
}) {
  const parts: string[] = [];

  const phoneLabel = cleanNullableString(input.phoneNumberLabel);
  const routingMode = humanizeEnum(input.routingMode);
  const agentName = cleanNullableString(input.agentName);

  if (phoneLabel) {
    parts.push(`Phone line label: ${phoneLabel}.`);
  }

  if (routingMode) {
    parts.push(`Configured routing mode: ${routingMode}.`);
  }

  if (agentName) {
    parts.push(`Agent profile identity: ${agentName}.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

export function composeFrontdeskSessionContext(
  input: FrontdeskSessionContextInput
): FrontdeskSessionContext {
  const businessName = cleanNullableString(input.businessName) ?? 'the business';
  const businessVertical = humanizeEnum(cleanNullableString(input.businessVertical));
  const timezone = cleanNullableString(input.timezone);
  const now = input.now ?? new Date();
  const sortedHours = [...input.businessHours].sort(
    (left, right) =>
      WEEKDAY_ORDER.indexOf(left.weekday) - WEEKDAY_ORDER.indexOf(right.weekday)
  );
  const hoursDescription = describeCurrentHours(sortedHours, timezone, now);
  const serviceAreaDescription = describeServiceAreas(input.serviceAreas);
  const phoneLineDescription = describePhoneLine({
    phoneNumberLabel: input.phoneNumberLabel,
    routingMode: input.routingMode,
    agentName: input.agentName
  });
  const verticalLine = businessVertical
    ? `Business vertical: ${businessVertical}.`
    : 'Business vertical is not configured. Do not assume services beyond what the caller describes.';
  const timezoneLine = timezone
    ? `Business timezone: ${timezone}.`
    : 'Business timezone is not configured. Avoid time-specific promises.';
  const override = cleanNullableString(input.agentSystemPrompt);

  const instructions = [
    `You are the AI front desk for ${businessName}.`,
    'Mission: keep inbound demand visible, gather reliable facts, and move the call toward a clear next action for the business.',
    verticalLine,
    timezoneLine,
    phoneLineDescription,
    'Primary tasks: identify the caller, understand the issue, capture urgency, and collect callback details and service location when needed.',
    'Urgency handling: reason about safety risk, active damage, complete outages, and same-day impact. If urgency is unclear, ask one short clarifying question instead of guessing.',
    'Unknown handling: do not fabricate pricing, dispatch timing, booking availability, service coverage, or internal policy. State uncertainty plainly and keep collecting the facts a human operator will need.',
    ...hoursDescription.lines,
    serviceAreaDescription,
    override
      ? `Additional business-specific instruction from the agent profile: ${override}`
      : 'No additional agent-profile instruction is configured. Stay concise, operational, and front-desk focused.'
  ]
    .filter(Boolean)
    .join('\n');

  return {
    instructions,
    metadata: {
      businessName,
      businessVertical,
      timezone,
      hoursState: hoursDescription.hoursState,
      serviceAreaCount: input.serviceAreas.length,
      routingMode: cleanNullableString(input.routingMode)
    }
  };
}
