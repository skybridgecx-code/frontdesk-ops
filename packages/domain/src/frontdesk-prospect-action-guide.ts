export type FrontdeskProspectActionGuideInput = {
  status:
    | 'NEW'
    | 'READY'
    | 'IN_PROGRESS'
    | 'ATTEMPTED'
    | 'RESPONDED'
    | 'QUALIFIED'
    | 'DISQUALIFIED'
    | 'ARCHIVED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  nextActionAt: string | Date | null;
  lastAttemptAt: string | Date | null;
  respondedAt: string | Date | null;
  archivedAt: string | Date | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactName: string | null;
  companyName: string;
  serviceInterest: string | null;
  notes: string | null;
  sourceLabel: string | null;
  sourceCategory: string | null;
  sourceRoleTitle: string | null;
  attempts: Array<{
    channel: string;
    outcome: string;
    note: string | null;
    attemptedAt: string | Date;
    createdAt: string | Date;
  }>;
  now?: Date;
};

export type FrontdeskProspectActionGuide = {
  primaryAction: string;
  reason: string;
  attentionLevel: 'high' | 'normal' | 'low';
  missingInfo: string[];
  readyForOutreach: boolean;
  needsReplyHandling: boolean;
  needsQualificationReview: boolean;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function toDate(value: string | Date | null) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isDueNow(value: string | Date | null, now: Date) {
  const parsed = toDate(value);
  if (!parsed) {
    return true;
  }

  return parsed.getTime() <= now.getTime();
}

function getMissingInfo(input: FrontdeskProspectActionGuideInput) {
  const missing: string[] = [];

  if (!hasText(input.contactPhone) && !hasText(input.contactEmail)) {
    missing.push('contact method');
  }

  if (!hasText(input.contactName)) {
    missing.push('contact name');
  }

  if (!hasText(input.serviceInterest)) {
    missing.push('service interest');
  }

  return missing;
}

function getAttentionLevel(input: FrontdeskProspectActionGuideInput): FrontdeskProspectActionGuide['attentionLevel'] {
  if (input.status === 'RESPONDED' || input.status === 'QUALIFIED' || input.priority === 'HIGH') {
    return 'high';
  }

  if (input.status === 'ARCHIVED' || input.status === 'DISQUALIFIED') {
    return 'low';
  }

  return 'normal';
}

export function buildFrontdeskProspectActionGuide(
  input: FrontdeskProspectActionGuideInput
): FrontdeskProspectActionGuide {
  const now = input.now ?? new Date();
  const missingInfo = getMissingInfo(input);
  const hasContactMethod = hasText(input.contactPhone) || hasText(input.contactEmail);
  const attentionLevel = getAttentionLevel(input);
  const hasReply = Boolean(input.respondedAt) || input.attempts.some((attempt) => attempt.outcome === 'REPLIED');

  if (input.status === 'ARCHIVED' || input.archivedAt) {
    return {
      primaryAction: 'No further action. Keep this prospect archived.',
      reason: 'Archived prospects should stay out of active outreach work.',
      attentionLevel: 'low',
      missingInfo,
      readyForOutreach: false,
      needsReplyHandling: false,
      needsQualificationReview: false
    };
  }

  if (input.status === 'DISQUALIFIED') {
    return {
      primaryAction: 'No further outreach. Confirm the disqualification note is clear.',
      reason: 'This prospect is already marked disqualified and should not return to active follow-up without a manual decision.',
      attentionLevel: 'low',
      missingInfo,
      readyForOutreach: false,
      needsReplyHandling: false,
      needsQualificationReview: false
    };
  }

  if (input.status === 'QUALIFIED') {
    return {
      primaryAction: 'Confirm qualified handoff and the next human follow-up step.',
      reason: 'Qualified prospects need confirmation that the handoff or next owner is clear, not another cold outreach touch.',
      attentionLevel: 'high',
      missingInfo,
      readyForOutreach: false,
      needsReplyHandling: false,
      needsQualificationReview: true
    };
  }

  if (input.status === 'RESPONDED' || hasReply) {
    return {
      primaryAction: 'Review the reply and decide whether to qualify, answer questions, or disqualify.',
      reason: 'A response is already on record, so the next operator step is reply handling and qualification rather than another blind touch.',
      attentionLevel: 'high',
      missingInfo,
      readyForOutreach: false,
      needsReplyHandling: true,
      needsQualificationReview: true
    };
  }

  if (!hasContactMethod) {
    return {
      primaryAction: 'Find a usable contact method before outreach.',
      reason: 'This prospect cannot move into reliable outreach without at least one phone number or email address.',
      attentionLevel,
      missingInfo,
      readyForOutreach: false,
      needsReplyHandling: false,
      needsQualificationReview: false
    };
  }

  if (input.status === 'ATTEMPTED') {
    if (isDueNow(input.nextActionAt, now)) {
      return {
        primaryAction: 'Send the next follow-up now.',
        reason: input.lastAttemptAt
          ? 'This prospect has prior outreach on record and the next action is due now.'
          : 'The prospect is in attempted state and the next action is due now.',
        attentionLevel,
        missingInfo,
        readyForOutreach: true,
        needsReplyHandling: false,
        needsQualificationReview: false
      };
    }

    return {
      primaryAction: 'Wait for the next action time and prep the next follow-up.',
      reason: 'A follow-up is already scheduled, so the immediate operator job is to keep context clean until that time arrives.',
      attentionLevel: 'normal',
      missingInfo,
      readyForOutreach: false,
      needsReplyHandling: false,
      needsQualificationReview: false
    };
  }

  if (input.status === 'NEW') {
    return {
      primaryAction: 'Review the record and prepare the first outreach.',
      reason: 'This prospect is new and has not moved into a worked outreach state yet.',
      attentionLevel,
      missingInfo,
      readyForOutreach: hasContactMethod,
      needsReplyHandling: false,
      needsQualificationReview: false
    };
  }

  if (input.status === 'IN_PROGRESS') {
    return {
      primaryAction: 'Continue the active outreach or qualification thread.',
      reason: 'This prospect is already in progress, so the next step is to continue the existing thread instead of restarting it.',
      attentionLevel,
      missingInfo,
      readyForOutreach: hasContactMethod,
      needsReplyHandling: false,
      needsQualificationReview: false
    };
  }

  if (input.status === 'READY') {
    if (!input.nextActionAt) {
      return {
        primaryAction: 'Start outreach now and set the next action time.',
        reason: 'The prospect is ready, contactable, and does not yet have a scheduled next action.',
        attentionLevel,
        missingInfo,
        readyForOutreach: true,
        needsReplyHandling: false,
        needsQualificationReview: false
      };
    }

    if (isDueNow(input.nextActionAt, now)) {
      return {
        primaryAction: 'Start outreach now.',
        reason: 'The prospect is ready and the scheduled next action time is already due.',
        attentionLevel,
        missingInfo,
        readyForOutreach: true,
        needsReplyHandling: false,
        needsQualificationReview: false
      };
    }

    return {
      primaryAction: 'Keep this prospect queued for the scheduled next action time.',
      reason: 'The prospect is ready, but the next action is already scheduled for later.',
      attentionLevel: 'normal',
      missingInfo,
      readyForOutreach: false,
      needsReplyHandling: false,
      needsQualificationReview: false
    };
  }

  return {
    primaryAction: 'Review the record and choose the next manual outreach step.',
    reason: 'The current prospect state still requires an operator decision before more work happens.',
    attentionLevel,
    missingInfo,
    readyForOutreach: hasContactMethod,
    needsReplyHandling: false,
    needsQualificationReview: false
  };
}
