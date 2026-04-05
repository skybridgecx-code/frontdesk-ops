import type { ProspectAttempt, ProspectDetail } from './prospect-detail-flow';

export type ProspectOutreachDraft = {
  qualificationScore: number;
  priorityBand: 'low' | 'medium' | 'high' | 'urgent';
  fitSummary: string;
  chosenAngle: string;
  firstEmailSubject: string;
  firstEmailBody: string;
  shortDmText: string;
  followUp1: string;
  followUp2: string;
  callOpener: string;
  crmNote: string;
};

export type ProspectOutreachState =
  | {
      status: 'idle';
      message: string | null;
      draft: ProspectOutreachDraft | null;
      generatedAt: string | null;
    }
  | {
      status: 'success';
      message: string | null;
      draft: ProspectOutreachDraft;
      generatedAt: string;
    }
  | {
      status: 'error';
      message: string | null;
      draft: ProspectOutreachDraft | null;
      generatedAt: string | null;
    };

export type ProspectOutreachSnapshot = {
  prospect: Pick<
    ProspectDetail,
    | 'prospectSid'
    | 'companyName'
    | 'contactName'
    | 'contactPhone'
    | 'contactEmail'
    | 'city'
    | 'state'
    | 'sourceLabel'
    | 'status'
    | 'priority'
    | 'serviceInterest'
    | 'notes'
    | 'nextActionAt'
    | 'lastAttemptAt'
  >;
  recentAttempts: Array<Pick<ProspectAttempt, 'attemptedAt' | 'channel' | 'outcome' | 'note'>>;
};

export const initialProspectOutreachState: ProspectOutreachState = {
  status: 'idle',
  message: null,
  draft: null,
  generatedAt: null
};

export function buildProspectOutreachSnapshot(
  prospect: Pick<
    ProspectDetail,
    | 'prospectSid'
    | 'companyName'
    | 'contactName'
    | 'contactPhone'
    | 'contactEmail'
    | 'city'
    | 'state'
    | 'sourceLabel'
    | 'status'
    | 'priority'
    | 'serviceInterest'
    | 'notes'
    | 'nextActionAt'
    | 'lastAttemptAt'
  >,
  attempts: ProspectAttempt[]
): ProspectOutreachSnapshot {
  return {
    prospect: {
      prospectSid: prospect.prospectSid,
      companyName: prospect.companyName,
      contactName: prospect.contactName,
      contactPhone: prospect.contactPhone,
      contactEmail: prospect.contactEmail,
      city: prospect.city,
      state: prospect.state,
      sourceLabel: prospect.sourceLabel,
      status: prospect.status,
      priority: prospect.priority,
      serviceInterest: prospect.serviceInterest,
      notes: prospect.notes,
      nextActionAt: prospect.nextActionAt,
      lastAttemptAt: prospect.lastAttemptAt
    },
    recentAttempts: attempts.slice(0, 3).map((attempt) => ({
      attemptedAt: attempt.attemptedAt,
      channel: attempt.channel,
      outcome: attempt.outcome,
      note: attempt.note
    }))
  };
}
