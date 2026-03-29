import {
  buildFrontdeskCallActionGuide,
  buildFrontdeskProspectActionGuide,
  type FrontdeskCallActionGuideInput,
  type FrontdeskProspectActionGuideInput
} from '@frontdesk/domain';

export type QueueActionHint = {
  label: string;
  reason: string;
  tone: 'high' | 'normal' | 'low';
};

export function getCallQueueActionHint(input: FrontdeskCallActionGuideInput): QueueActionHint {
  const guide = buildFrontdeskCallActionGuide(input);

  if (guide.missingInfo.includes('callback phone')) {
    return {
      label: 'Need callback number',
      reason: guide.reason,
      tone: 'normal'
    };
  }

  if (guide.needsTranscriptReview) {
    return {
      label: 'Review transcript',
      reason: guide.reason,
      tone: guide.urgencyLevel === 'normal' ? 'normal' : 'high'
    };
  }

  if (guide.readyToContact) {
    return {
      label: guide.urgencyLevel === 'emergency' || guide.urgencyLevel === 'high' ? 'Call back now' : 'Call back',
      reason: guide.reason,
      tone: guide.urgencyLevel === 'normal' ? 'normal' : 'high'
    };
  }

  if (input.triageStatus === 'CONTACTED' || input.contactedAt) {
    return {
      label: 'Check outcome',
      reason: guide.reason,
      tone: 'normal'
    };
  }

  if (input.triageStatus === 'ARCHIVED' || input.archivedAt) {
    return {
      label: 'Archived',
      reason: guide.reason,
      tone: 'low'
    };
  }

  return {
    label: 'Review call',
    reason: guide.reason,
    tone: guide.urgencyLevel === 'normal' ? 'normal' : 'high'
  };
}

export function getProspectQueueActionHint(input: FrontdeskProspectActionGuideInput): QueueActionHint {
  const guide = buildFrontdeskProspectActionGuide(input);

  if (guide.needsReplyHandling) {
    return {
      label: 'Handle reply',
      reason: guide.reason,
      tone: 'high'
    };
  }

  if (input.status === 'QUALIFIED' || guide.needsQualificationReview) {
    return {
      label: 'Confirm handoff',
      reason: guide.reason,
      tone: 'high'
    };
  }

  if (guide.missingInfo.includes('contact method')) {
    return {
      label: 'Need contact method',
      reason: guide.reason,
      tone: 'normal'
    };
  }

  if (guide.readyForOutreach) {
    return {
      label: input.status === 'ATTEMPTED' ? 'Follow up now' : 'Start outreach',
      reason: guide.reason,
      tone: guide.attentionLevel === 'high' ? 'high' : 'normal'
    };
  }

  if (input.status === 'ARCHIVED' || input.archivedAt) {
    return {
      label: 'Archived',
      reason: guide.reason,
      tone: 'low'
    };
  }

  if (input.status === 'DISQUALIFIED') {
    return {
      label: 'Disqualified',
      reason: guide.reason,
      tone: 'low'
    };
  }

  return {
    label: 'Queued next step',
    reason: guide.reason,
    tone: guide.attentionLevel
  };
}
