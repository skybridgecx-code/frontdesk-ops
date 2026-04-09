'use server';

import { generateProspectOutreachDraft, isProspectOutreachConfigured } from '@frontdesk/integrations';
import {
  type ProspectOutreachSnapshot,
  initialProspectOutreachState,
  type ProspectOutreachState
} from './outreach-copilot.shared';

type SerializedSnapshot = {
  snapshot?: ProspectOutreachSnapshot;
};

const outreachGoals = ['book_call', 'send_walkthrough', 'find_right_contact'] as const;
const outreachLengths = ['short', 'medium'] as const;
const outreachTones = ['direct', 'warm'] as const;

type OutreachGoal = (typeof outreachGoals)[number];
type OutreachLength = (typeof outreachLengths)[number];
type OutreachTone = (typeof outreachTones)[number];

type ProspectOutreachGenerationOptions = {
  goal: OutreachGoal;
  length: OutreachLength;
  tone: OutreachTone;
};

const defaultOutreachOptions: ProspectOutreachGenerationOptions = {
  goal: 'book_call',
  length: 'short',
  tone: 'direct'
};

export async function getProspectOutreachAvailability() {
  const unavailableReason = isProspectOutreachConfigured()
    ? null
    : 'Outreach copilot is unavailable until OPENAI_API_KEY is configured on the server.';

  return {
    enabled: unavailableReason === null,
    unavailableReason
  };
}

function readSerializedSnapshot(formData: FormData): ProspectOutreachSnapshot | null {
  const raw = String(formData.get('prospectSnapshot') ?? '').trim();

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SerializedSnapshot;
    return parsed.snapshot ?? null;
  } catch {
    return null;
  }
}

function readOutreachGenerationOptions(formData: FormData): ProspectOutreachGenerationOptions {
  const goal = String(formData.get('outreachGoal') ?? '').trim();
  const length = String(formData.get('outreachLength') ?? '').trim();
  const tone = String(formData.get('outreachTone') ?? '').trim();

  return {
    goal: outreachGoals.includes(goal as OutreachGoal) ? (goal as OutreachGoal) : defaultOutreachOptions.goal,
    length: outreachLengths.includes(length as OutreachLength) ? (length as OutreachLength) : defaultOutreachOptions.length,
    tone: outreachTones.includes(tone as OutreachTone) ? (tone as OutreachTone) : defaultOutreachOptions.tone
  };
}

export async function generateProspectOutreachDraftAction(
  previousState: ProspectOutreachState = initialProspectOutreachState,
  formData: FormData
): Promise<ProspectOutreachState> {
  const availability = await getProspectOutreachAvailability();

  if (!availability.enabled) {
    return {
      ...previousState,
      status: 'error',
      message: availability.unavailableReason
    };
  }

  const snapshot = readSerializedSnapshot(formData);
  const outreachOptions = readOutreachGenerationOptions(formData);

  if (!snapshot) {
    return {
      ...previousState,
      status: 'error',
      message: 'Could not read the prospect snapshot for outreach generation.'
    };
  }

  try {
    const draft = await generateProspectOutreachDraft({
      companyName: snapshot.prospect.companyName,
      contactName: snapshot.prospect.contactName,
      contactPhone: snapshot.prospect.contactPhone,
      contactEmail: snapshot.prospect.contactEmail,
      city: snapshot.prospect.city,
      state: snapshot.prospect.state,
      sourceLabel: snapshot.prospect.sourceLabel,
      status: snapshot.prospect.status,
      priority: snapshot.prospect.priority,
      serviceInterest: snapshot.prospect.serviceInterest,
      notes: snapshot.prospect.notes,
      nextActionAt: snapshot.prospect.nextActionAt,
      lastAttemptAt: snapshot.prospect.lastAttemptAt,
      recentAttempts: snapshot.recentAttempts
    }, outreachOptions);

    return {
      status: 'success',
      message: 'Outreach package generated.',
      draft,
      generatedAt: new Date().toISOString()
    };
  } catch {
    return {
      ...previousState,
      status: 'error',
      message: 'Could not generate the outreach package. Check the server model configuration and try again.'
    };
  }
}
