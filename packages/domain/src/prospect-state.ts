/**
 * Prospect lifecycle state machine.
 *
 * Prospects move through a linear pipeline:
 *   NEW → READY → IN_PROGRESS → ATTEMPTED → (terminal)
 *
 * Terminal statuses: RESPONDED, QUALIFIED, DISQUALIFIED, ARCHIVED.
 * Once terminal, a prospect's `nextActionAt` is always cleared (set to null)
 * and the status is preserved even if new outreach attempts are logged.
 *
 * Shortcuts (no-answer, voicemail, responded, qualified, disqualified, archive)
 * encode common operator actions into a single status + nextActionAt + attempt bundle.
 */

export const prospectTerminalStatuses = ['RESPONDED', 'QUALIFIED', 'DISQUALIFIED', 'ARCHIVED'] as const;
export const prospectAttemptTransitionStatuses = ['NEW', 'READY', 'IN_PROGRESS', 'ATTEMPTED'] as const;

export type ProspectTerminalStatus = (typeof prospectTerminalStatuses)[number];
export type ProspectAttemptTransitionStatus = (typeof prospectAttemptTransitionStatuses)[number];
export type ProspectStatusValue = ProspectTerminalStatus | ProspectAttemptTransitionStatus;

export type ProspectShortcutKind =
  | 'no-answer'
  | 'voicemail'
  | 'responded'
  | 'qualified'
  | 'disqualified'
  | 'archive';

export type ProspectShortcutTransition = {
  status: ProspectStatusValue;
  nextActionAt: Date | null;
  attempt?: {
    channel: 'CALL';
    outcome: 'NO_ANSWER' | 'LEFT_VOICEMAIL';
    note: string;
  };
};

/** Returns true if the given status string is a terminal prospect status. */
export function isProspectTerminalStatus(status: string | null | undefined): status is ProspectTerminalStatus {
  return prospectTerminalStatuses.includes(status as ProspectTerminalStatus);
}

/**
 * After logging an outreach attempt, determines the new prospect status.
 * Terminal prospects keep their current status; non-terminal prospects move to ATTEMPTED.
 */
export function normalizeProspectStatusAfterAttempt(status: string | null | undefined) {
  return isProspectTerminalStatus(status) ? status : 'ATTEMPTED';
}

/**
 * Clears `nextActionAt` for terminal prospects (they should never appear in the action queue).
 * Non-terminal prospects keep whatever `nextActionAt` was provided.
 */
export function normalizeProspectNextActionAt(status: string | null | undefined, nextActionAt: Date | null) {
  return isProspectTerminalStatus(status) ? null : nextActionAt;
}

/** Creates a follow-up date N hours from now. Used by shortcut transitions. */
export function buildProspectFollowUpDate(hoursFromNow: number) {
  const next = new Date();
  next.setHours(next.getHours() + hoursFromNow);
  return next;
}

/**
 * Resolves a shortcut kind (e.g. 'no-answer', 'qualified') into a concrete
 * status transition, optional follow-up date, and optional attempt record.
 *
 * - `no-answer`: moves to ATTEMPTED with 24h follow-up (unless already terminal).
 * - `voicemail`: moves to ATTEMPTED with 48h follow-up (unless already terminal).
 * - `responded` / `qualified` / `disqualified` / `archive`: moves to the corresponding
 *   terminal status and clears `nextActionAt`.
 */
export function getProspectShortcutTransition(
  kind: ProspectShortcutKind,
  currentStatus: ProspectStatusValue
): ProspectShortcutTransition {
  const shouldScheduleFollowUp = !isProspectTerminalStatus(currentStatus);
  const terminalStatus: ProspectTerminalStatus =
    kind === 'responded'
      ? 'RESPONDED'
      : kind === 'qualified'
        ? 'QUALIFIED'
        : kind === 'disqualified'
          ? 'DISQUALIFIED'
          : 'ARCHIVED';

  switch (kind) {
    case 'no-answer':
      return {
        status: shouldScheduleFollowUp ? 'ATTEMPTED' : currentStatus,
        nextActionAt: shouldScheduleFollowUp ? buildProspectFollowUpDate(24) : null,
        attempt: {
          channel: 'CALL',
          outcome: 'NO_ANSWER',
          note: 'No answer. Follow-up scheduled.'
        }
      };
    case 'voicemail':
      return {
        status: shouldScheduleFollowUp ? 'ATTEMPTED' : currentStatus,
        nextActionAt: shouldScheduleFollowUp ? buildProspectFollowUpDate(48) : null,
        attempt: {
          channel: 'CALL',
          outcome: 'LEFT_VOICEMAIL',
          note: 'Left voicemail. Follow-up scheduled.'
        }
      };
    case 'responded':
    case 'qualified':
    case 'disqualified':
    case 'archive':
      return {
        status: terminalStatus,
        nextActionAt: null
      };
  }
}
