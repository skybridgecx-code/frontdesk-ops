/**
 * Prospect read model — derives display-ready signals from raw prospect data.
 *
 * The read model computes:
 * - Whether a prospect is terminal (no further outreach expected)
 * - Whether it has a scheduled next action and/or a recorded last attempt
 * - Whether it's actionable (non-terminal with a next action)
 * - A queue state label: 'overdue' | 'due now' | 'upcoming' | 'no next action'
 *
 * These signals drive the operator dashboard queue view without leaking
 * state-machine logic into the frontend.
 */

import { isProspectTerminalStatus, type ProspectStatusValue } from './prospect-state';

export const prospectQueueStateLabels = ['overdue', 'due now', 'upcoming', 'no next action'] as const;

export type ProspectQueueStateLabel = (typeof prospectQueueStateLabels)[number];

/** Computed display signals attached to every prospect in API responses. */
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

/**
 * Classifies a prospect's next action into a queue label relative to `nowMs`.
 * - Past `nextActionAt` → 'overdue'
 * - Within 24 hours → 'due now'
 * - Further out → 'upcoming'
 * - Missing → 'no next action'
 */
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

/**
 * Computes the full set of read signals for a prospect.
 * Terminal prospects always have `isActionable: false` and `queueStateLabel: 'no next action'`,
 * even if a stale `nextActionAt` value is still present in the database.
 */
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
