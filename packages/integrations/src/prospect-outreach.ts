import OpenAI from 'openai';

export type ProspectOutreachAttemptSummary = {
  attemptedAt: string;
  channel: string;
  outcome: string;
  note: string | null;
};

export type ProspectOutreachInput = {
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string | null;
  status: string;
  priority: string | null;
  serviceInterest: string | null;
  notes: string | null;
  nextActionAt: string | null;
  lastAttemptAt: string | null;
  recentAttempts: ProspectOutreachAttemptSummary[];
};

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

export type ProspectOutreachGoal = 'book_call' | 'send_walkthrough' | 'find_right_contact';
export type ProspectOutreachLength = 'short' | 'medium';
export type ProspectOutreachTone = 'direct' | 'warm';

export type ProspectOutreachGenerationOptions = {
  goal: ProspectOutreachGoal;
  length: ProspectOutreachLength;
  tone: ProspectOutreachTone;
};

export const defaultProspectOutreachGenerationOptions: ProspectOutreachGenerationOptions = {
  goal: 'book_call',
  length: 'short',
  tone: 'direct'
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  return new OpenAI({ apiKey });
}

function cleanNullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid outreach draft: ${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Invalid outreach draft: ${fieldName} cannot be empty`);
  }

  return trimmed;
}

function clampQualificationScore(value: unknown) {
  const score = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(25, Math.trunc(score)));
}

export function getProspectOutreachPriorityBand(score: number): ProspectOutreachDraft['priorityBand'] {
  if (score >= 22) {
    return 'urgent';
  }

  if (score >= 17) {
    return 'high';
  }

  if (score >= 10) {
    return 'medium';
  }

  return 'low';
}

function formatField(label: string, value: string | null | undefined) {
  return `${label}: ${value?.trim() || '—'}`;
}

function formatAttempt(attempt: ProspectOutreachAttemptSummary, index: number) {
  const note = attempt.note?.trim();

  return [
    `Attempt ${index + 1}`,
    formatField('At', attempt.attemptedAt),
    formatField('Channel', attempt.channel),
    formatField('Outcome', attempt.outcome),
    formatField('Note', note || null)
  ].join('\n');
}

function describeProspectOutreachGoal(goal: ProspectOutreachGoal) {
  switch (goal) {
    case 'send_walkthrough':
      return 'send a short walkthrough and see if they want to review it';
    case 'find_right_contact':
      return 'find the right person quickly and keep the handoff simple';
    case 'book_call':
    default:
      return 'book a short call';
  }
}

function describeProspectOutreachLength(length: ProspectOutreachLength) {
  return length === 'medium'
    ? 'medium: first email body around 110-140 words, follow-ups still brief, no long analysis'
    : 'short: first email body around 90-115 words, follow-ups 1-2 short sentences, no long analysis';
}

function describeProspectOutreachTone(tone: ProspectOutreachTone) {
  return tone === 'warm' ? 'warm' : 'direct';
}

export function buildProspectOutreachPrompt(
  input: ProspectOutreachInput,
  options: ProspectOutreachGenerationOptions = defaultProspectOutreachGenerationOptions
) {
  const location = [input.city, input.state].filter(Boolean).join(', ');
  const attempts = input.recentAttempts.slice(0, 3);
  const goalDescription = describeProspectOutreachGoal(options.goal);
  const lengthDescription = describeProspectOutreachLength(options.length);
  const toneDescription = describeProspectOutreachTone(options.tone);

  return [
    'You are helping a human operator draft a commercial outreach package for a home-service business prospect.',
    'Do not mention AI, models, prompts, or internal tools.',
    'Lead with missed inbound jobs, slow follow-up, invisible intake, routing friction, and lost opportunities.',
    `Operator goal: ${goalDescription}.`,
    `Output length: ${lengthDescription}.`,
    `Tone: ${toneDescription}.`,
    'Use only the supplied prospect data and notes. Do not invent names, outcomes, case studies, audits, diagnostics, or any facts not present in the input.',
    'Prefer one believable angle over generic personalization. Choose one primary angle only.',
    'The chosen angle should be a single concise sentence, not a list of options or a memo.',
    'Write like a serious operator. Plain, concrete, commercial, and specific.',
    'If the data is thin, stay conservative rather than filling in blanks.',
    'Do not overexplain the service. Make the first touch easy to answer.',
    'In the first email subject, first email body, DM/text, and call opener, avoid audit, review, diagnostic, memo, and consultant-report framing by default.',
    'Keep the first email subject to 3-6 words if possible.',
    'Keep the first email body short, reply-oriented, and easy to skim.',
    'Keep the DM/text to about 35-60 words.',
    'Keep follow-up 1 to one short sentence or two at most.',
    'Keep follow-up 2 to one short sentence or two at most.',
    'Keep the call opener conversational and under two sentences.',
    options.goal === 'book_call'
      ? 'Make the ask simple: a short call to see if there is a fit.'
      : options.goal === 'send_walkthrough'
        ? 'Make the ask simple: a short walkthrough that is easy to skim.'
        : 'Make the ask simple: identify the right person to speak with.',
    options.goal === 'send_walkthrough'
      ? 'If you mention a walkthrough, keep it light and practical. Do not turn it into an audit or analysis.'
      : 'Do not force audit-style framing into the first touch.',
    '',
    'Prospect snapshot:',
    formatField('Company', input.companyName),
    formatField('Contact', input.contactName),
    formatField('Phone', input.contactPhone),
    formatField('Email', input.contactEmail),
    formatField('Location', location || null),
    formatField('Source label', input.sourceLabel),
    formatField('Status', input.status),
    formatField('Priority', input.priority),
    formatField('Service interest', input.serviceInterest),
    formatField('Next action at', input.nextActionAt),
    formatField('Last attempt at', input.lastAttemptAt),
    formatField('Notes', input.notes),
    '',
    'Recent attempts:',
    attempts.length > 0 ? attempts.map(formatAttempt).join('\n\n') : 'No attempts recorded.',
    '',
    'Return a JSON object with these keys only:',
    'qualificationScore, fitSummary, chosenAngle, firstEmailSubject, firstEmailBody, shortDmText, followUp1, followUp2, callOpener, crmNote.',
    'qualificationScore must be an integer from 0 to 25.',
    'Keep follow-up messages short enough to send in sequence and clearly shorter than the first email.',
    'The CRM note should be concise and operational.'
  ].join('\n');
}

export function normalizeProspectOutreachDraft(parsed: Record<string, unknown>): ProspectOutreachDraft {
  const qualificationScore = clampQualificationScore(parsed.qualificationScore);

  return {
    qualificationScore,
    priorityBand: getProspectOutreachPriorityBand(qualificationScore),
    fitSummary: cleanRequiredString(parsed.fitSummary, 'fitSummary'),
    chosenAngle: cleanRequiredString(parsed.chosenAngle, 'chosenAngle'),
    firstEmailSubject: cleanRequiredString(parsed.firstEmailSubject, 'firstEmailSubject'),
    firstEmailBody: cleanRequiredString(parsed.firstEmailBody, 'firstEmailBody'),
    shortDmText: cleanRequiredString(parsed.shortDmText, 'shortDmText'),
    followUp1: cleanRequiredString(parsed.followUp1, 'followUp1'),
    followUp2: cleanRequiredString(parsed.followUp2, 'followUp2'),
    callOpener: cleanRequiredString(parsed.callOpener, 'callOpener'),
    crmNote: cleanRequiredString(parsed.crmNote, 'crmNote')
  };
}

export async function generateProspectOutreachDraft(
  input: ProspectOutreachInput,
  options: ProspectOutreachGenerationOptions = defaultProspectOutreachGenerationOptions
) {
  const client = getOpenAIClient();

  const response = await client.responses.create({
    model: process.env.OPENAI_OUTREACH_MODEL ?? 'gpt-5-mini',
    store: false,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'Draft a structured outreach package for a home-service prospect. Do not mention AI. Do not invent facts. Keep the copy plain, commercial, and operator-useful.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: buildProspectOutreachPrompt(input, options)
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'prospect_outreach_draft',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            qualificationScore: {
              type: 'integer',
              minimum: 0,
              maximum: 25
            },
            fitSummary: {
              type: 'string'
            },
            chosenAngle: {
              type: 'string'
            },
            firstEmailSubject: {
              type: 'string'
            },
            firstEmailBody: {
              type: 'string'
            },
            shortDmText: {
              type: 'string'
            },
            followUp1: {
              type: 'string'
            },
            followUp2: {
              type: 'string'
            },
            callOpener: {
              type: 'string'
            },
            crmNote: {
              type: 'string'
            }
          },
          required: [
            'qualificationScore',
            'fitSummary',
            'chosenAngle',
            'firstEmailSubject',
            'firstEmailBody',
            'shortDmText',
            'followUp1',
            'followUp2',
            'callOpener',
            'crmNote'
          ]
        }
      }
    }
  } as never);

  const parsed = JSON.parse(response.output_text) as Record<string, unknown>;
  return normalizeProspectOutreachDraft(parsed);
}

export function isProspectOutreachConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}
