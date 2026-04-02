export type FrontdeskCallActionGuideInput = {
  triageStatus: 'OPEN' | 'CONTACTED' | 'ARCHIVED';
  reviewStatus: 'UNREVIEWED' | 'REVIEWED' | 'NEEDS_REVIEW';
  contactedAt: string | Date | null;
  archivedAt: string | Date | null;
  urgency: string | null;
  leadName: string | null;
  leadPhone: string | null;
  fromE164: string | null;
  leadIntent: string | null;
  serviceAddress: string | null;
  summary: string | null;
  callerTranscript: string | null;
  assistantTranscript: string | null;
};

export type FrontdeskCallActionGuide = {
  primaryAction: string;
  reason: string;
  urgencyLevel: 'emergency' | 'high' | 'normal';
  missingInfo: string[];
  readyToContact: boolean;
  needsTranscriptReview: boolean;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function normalizeUrgencyLevel(value: string | null): FrontdeskCallActionGuide['urgencyLevel'] {
  if (value === 'emergency') {
    return 'emergency';
  }

  if (value === 'high') {
    return 'high';
  }

  return 'normal';
}

function getMissingInfo(input: FrontdeskCallActionGuideInput) {
  const missing: string[] = [];

  if (!hasText(input.leadPhone) && !hasText(input.fromE164)) {
    missing.push('callback phone');
  }

  if (!hasText(input.leadName)) {
    missing.push('caller name');
  }

  if (!hasText(input.leadIntent)) {
    missing.push('issue summary');
  }

  if (!hasText(input.serviceAddress)) {
    missing.push('service address');
  }

  if (!hasText(input.summary)) {
    missing.push('operator-ready summary');
  }

  return missing;
}

export function buildFrontdeskCallActionGuide(
  input: FrontdeskCallActionGuideInput
): FrontdeskCallActionGuide {
  const urgencyLevel = normalizeUrgencyLevel(input.urgency);
  const missingInfo = getMissingInfo(input);
  const hasCallbackPhone = hasText(input.leadPhone) || hasText(input.fromE164);
  const hasTranscript = hasText(input.callerTranscript) || hasText(input.assistantTranscript);
  const needsTranscriptReview =
    hasTranscript &&
    (!hasText(input.summary) ||
      !hasText(input.leadIntent) ||
      input.reviewStatus === 'UNREVIEWED' ||
      input.reviewStatus === 'NEEDS_REVIEW');

  if (input.triageStatus === 'ARCHIVED' || input.archivedAt) {
    return {
      primaryAction: 'No further action. Keep this call archived.',
      reason: 'This call is already archived and should stay out of active follow-up work.',
      urgencyLevel,
      missingInfo,
      readyToContact: false,
      needsTranscriptReview: false
    };
  }

  if (input.triageStatus === 'CONTACTED' || input.contactedAt) {
    return {
      primaryAction: 'Check the last outreach result before taking another follow-up step.',
      reason: 'The call is already marked contacted, so the next operator step is to confirm outcome and only re-engage if needed.',
      urgencyLevel,
      missingInfo,
      readyToContact: false,
      needsTranscriptReview: false
    };
  }

  if (!hasCallbackPhone) {
    return {
      primaryAction: 'Review the call and capture a callback number before follow-up.',
      reason: 'A follow-up call cannot happen confidently without any callback phone on the record.',
      urgencyLevel,
      missingInfo,
      readyToContact: false,
      needsTranscriptReview: hasTranscript
    };
  }

  if (!hasText(input.summary) && hasTranscript) {
    return {
      primaryAction: 'Read the transcript and write a usable call summary before outreach.',
      reason: 'The call has transcript signal, but the extracted summary is still too thin for clean operator follow-up.',
      urgencyLevel,
      missingInfo,
      readyToContact: false,
      needsTranscriptReview: true
    };
  }

  if (input.reviewStatus === 'UNREVIEWED' && hasCallbackPhone) {
    if (urgencyLevel === 'emergency' || urgencyLevel === 'high') {
      return {
        primaryAction: 'Call back now and confirm the situation.',
        reason: 'This call is still unreviewed, but urgency is already high enough that callback should not wait.',
        urgencyLevel,
        missingInfo,
        readyToContact: true,
        needsTranscriptReview: false
      };
    }

    return {
      primaryAction: 'Finish a quick review, then call back.',
      reason: 'The caller can be reached, but the review state is still open and should be completed before outreach.',
      urgencyLevel,
      missingInfo,
      readyToContact: true,
      needsTranscriptReview
    };
  }

  if (input.reviewStatus === 'NEEDS_REVIEW') {
    return {
      primaryAction: 'Review the call before outreach.',
      reason: 'The current review state explicitly says this call still needs operator review before the next step.',
      urgencyLevel,
      missingInfo,
      readyToContact: hasCallbackPhone && !needsTranscriptReview,
      needsTranscriptReview
    };
  }

  if (urgencyLevel === 'emergency' || urgencyLevel === 'high') {
    return {
      primaryAction: 'Call back now and confirm urgency details.',
      reason: 'The call is active, reviewed enough to work, and flagged high urgency.',
      urgencyLevel,
      missingInfo,
      readyToContact: true,
      needsTranscriptReview: false
    };
  }

  return {
    primaryAction: 'Call back and confirm the next step with the caller.',
    reason: 'The call is open, has callback information, and has enough structured detail for normal follow-up.',
    urgencyLevel,
    missingInfo,
    readyToContact: true,
    needsTranscriptReview: false
  };
}
