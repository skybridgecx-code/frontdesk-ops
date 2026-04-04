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

export function isProspectTerminalStatus(status: string | null | undefined): status is ProspectTerminalStatus {
  return prospectTerminalStatuses.includes(status as ProspectTerminalStatus);
}

export function normalizeProspectStatusAfterAttempt(status: string | null | undefined) {
  return isProspectTerminalStatus(status) ? status : 'ATTEMPTED';
}

export function normalizeProspectNextActionAt(status: string | null | undefined, nextActionAt: Date | null) {
  return isProspectTerminalStatus(status) ? null : nextActionAt;
}

export function buildProspectFollowUpDate(hoursFromNow: number) {
  const next = new Date();
  next.setHours(next.getHours() + hoursFromNow);
  return next;
}

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
