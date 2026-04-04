export type ProspectDetail = {
  prospectSid: string;
  status: string;
  priority: string | null;
  notes: string | null;
  nextActionAt: string | null;
  lastAttemptAt: string | null;
  updatedAt: string;
  readState: {
    queueStateLabel: string;
  };
};

export type ProspectAttempt = {
  id: string;
  channel: string;
  outcome: string;
  note: string | null;
  attemptedAt: string;
  createdAt: string;
};

export type ProspectActivityTimelineEntry = {
  id: string;
  kind: 'snapshot' | 'attempt';
  eventTypeLabel: string;
  timestamp: string;
  description: string;
  detail: string | null;
};

function truncate(value: string, limit = 140) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '—';
}

export function buildProspectActivityTimeline(
  prospect: ProspectDetail,
  attempts: ProspectAttempt[]
): ProspectActivityTimelineEntry[] {
  const entries: ProspectActivityTimelineEntry[] = [];

  entries.push({
    id: `snapshot-${prospect.prospectSid}`,
    kind: 'snapshot',
    eventTypeLabel: 'Current snapshot',
    timestamp: prospect.updatedAt,
    description: [
      `Status ${formatLabel(prospect.status)}`,
      `Priority ${formatLabel(prospect.priority)}`,
      `Queue state ${prospect.readState.queueStateLabel}`,
      `Next action ${prospect.readState.queueStateLabel === 'no next action' ? 'No next action' : formatDateTime(prospect.nextActionAt)}`,
      `Last attempt ${prospect.lastAttemptAt ? formatDateTime(prospect.lastAttemptAt) : 'No attempts recorded'}`
    ].join(' · '),
    detail: prospect.notes ? `Note: ${truncate(prospect.notes)}` : 'No notes recorded.'
  });

  for (const attempt of attempts) {
    entries.push({
      id: attempt.id,
      kind: 'attempt',
      eventTypeLabel: 'Attempt',
      timestamp: attempt.attemptedAt,
      description: `${formatLabel(attempt.channel)} · ${formatLabel(attempt.outcome)}`,
      detail: attempt.note ? truncate(attempt.note) : 'No note recorded.'
    });
  }

  return entries.sort((a, b) => {
    const delta = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

    if (delta !== 0) {
      return delta;
    }

    if (a.kind === b.kind) {
      return 0;
    }

    return a.kind === 'snapshot' ? -1 : 1;
  });
}
