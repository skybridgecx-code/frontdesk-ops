import { isProspectTerminalStatus, type ProspectStatusValue } from './prospect-state';

export const prospectQueueStateLabels = ['overdue', 'due now', 'upcoming', 'no next action'] as const;

export type ProspectQueueStateLabel = (typeof prospectQueueStateLabels)[number];

export type ProspectReadSignals = {
  isTerminal: boolean;
  hasNextAction: boolean;
  hasLastAttempt: boolean;
  isActionable: boolean;
  queueStateLabel: ProspectQueueStateLabel;
};

type MaybeDateLike = string | Date | null | undefined;

function coerceDate(value: MaybeDateLike) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function getProspectQueueStateLabel(nextActionAt: MaybeDateLike, nowMs = Date.now()): ProspectQueueStateLabel {
  const nextActionTime = coerceDate(nextActionAt);

  if (!nextActionTime) {
    return 'no next action';
  }

  const nextActionMs = nextActionTime.getTime();

  if (nextActionMs < nowMs) {
    return 'overdue';
  }

  if (nextActionMs <= nowMs + 24 * 60 * 60 * 1000) {
    return 'due now';
  }

  return 'upcoming';
}

export function getProspectReadSignals(input: {
  status: ProspectStatusValue | string | null | undefined;
  nextActionAt: MaybeDateLike;
  lastAttemptAt?: MaybeDateLike;
  nowMs?: number;
}): ProspectReadSignals {
  const isTerminal = isProspectTerminalStatus(input.status);
  const nextActionVisible = !isTerminal && coerceDate(input.nextActionAt) !== null;
  const lastAttemptVisible = coerceDate(input.lastAttemptAt) !== null;

  return {
    isTerminal,
    hasNextAction: nextActionVisible,
    hasLastAttempt: lastAttemptVisible,
    isActionable: nextActionVisible,
    queueStateLabel: nextActionVisible ? getProspectQueueStateLabel(input.nextActionAt, input.nowMs) : 'no next action'
  };
}
