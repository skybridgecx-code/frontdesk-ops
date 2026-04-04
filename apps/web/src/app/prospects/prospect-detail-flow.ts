import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import {
  buildProspectDetailHref,
  buildProspectsRequestUrl,
  buildQueueContinuationHref,
  findNextQueueProspectSid,
  getQueueStatusFromReturnTo,
  PROSPECT_QUEUE_FETCH_LIMIT,
  prospectQueueStatuses,
  type ProspectQueueStatus
} from './queue-flow';
import {
  type ProspectReadSignals,
  getProspectShortcutTransition,
  normalizeProspectNextActionAt,
  type ProspectStatusValue
} from '@frontdesk/domain';

export type BootstrapResponse = {
  ok: true;
  tenant: {
    id: string;
    businesses: Array<{
      id: string;
      name: string;
    }>;
  } | null;
};

export type ProspectDetail = {
  prospectSid: string;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string | null;
  status: string;
  priority: string | null;
  lastAttemptAt: string | null;
  notes: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  readState: ProspectReadSignals;
};

export type ProspectDetailResponse = {
  ok: true;
  prospect: ProspectDetail;
};

export type ProspectAttempt = {
  id: string;
  channel: string;
  outcome: string;
  note: string | null;
  attemptedAt: string;
  createdAt: string;
};

export type ProspectAttemptsResponse = {
  ok: true;
  attempts: ProspectAttempt[];
};

export type ProspectQueueResponse = {
  ok: true;
  prospects: Array<{
    prospectSid: string;
  }>;
};

export const prospectStatuses = [
  'NEW',
  'READY',
  'IN_PROGRESS',
  'ATTEMPTED',
  'RESPONDED',
  'QUALIFIED',
  'DISQUALIFIED',
  'ARCHIVED'
] as const;

export const prospectPriorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
export const prospectAttemptChannels = ['CALL', 'EMAIL', 'SMS'] as const;
export const prospectAttemptOutcomes = [
  'NO_ANSWER',
  'LEFT_VOICEMAIL',
  'SENT_EMAIL',
  'REPLIED',
  'BAD_FIT',
  'DO_NOT_CONTACT'
] as const;

export function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '—';
}

export function formatDateTimeLocalInput(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function formatDateTimeLocalNow() {
  const now = new Date();
  const pad = (input: number) => String(input).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

export function formatLabel(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getProspectDetailNotice(notice: string | undefined) {
  switch (notice) {
    case 'saved':
      return 'Workflow updated.';
    case 'saved-next':
      return 'Workflow updated. Moved to next prospect.';
    case 'attempt-saved':
      return 'Attempt logged.';
    case 'attempt-saved-next':
      return 'Attempt logged. Moved to next prospect.';
    case 'error':
      return 'Could not save workflow changes.';
    case 'attempt-error':
      return 'Could not save attempt.';
    case 'shortcut-saved':
      return 'Disposition shortcut applied.';
    case 'shortcut-saved-next':
      return 'Disposition shortcut applied. Moved to next prospect.';
    case 'shortcut-error':
      return 'Could not apply disposition shortcut.';
    default:
      return null;
  }
}

export async function getBootstrap() {
  const res = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as BootstrapResponse;
}

export async function getProspect(businessId: string, prospectSid: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects/${prospectSid}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to load prospect: ${res.status}`);
  }

  return (await res.json()) as ProspectDetailResponse;
}

export async function getAttempts(businessId: string, prospectSid: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects/${prospectSid}/attempts`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospect attempts: ${res.status}`);
  }

  return (await res.json()) as ProspectAttemptsResponse;
}

export async function getProspectQueue(businessId: string, status?: string | null) {
  const url = buildProspectsRequestUrl({
    apiBaseUrl: getApiBaseUrl(),
    businessId,
    status: status ? (status as ProspectQueueStatus) : null,
    limit: PROSPECT_QUEUE_FETCH_LIMIT
  });

  const res = await fetch(url, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospect queue: ${res.status}`);
  }

  return (await res.json()) as ProspectQueueResponse;
}

export async function resolveQueueContext(
  businessId: string,
  prospectSid: string,
  queueReturnTo: string | null
) {
  if (!queueReturnTo) {
    return null;
  }

  const status = getQueueStatusFromReturnTo(queueReturnTo);

  try {
    const queueResponse = await getProspectQueue(businessId, status);
    const nextProspectSid = findNextQueueProspectSid(queueResponse.prospects, prospectSid);

    return {
      nextProspectSid,
      nextHref: nextProspectSid
        ? buildProspectDetailHref({
            prospectSid: nextProspectSid,
            returnTo: queueReturnTo
          })
        : null
    };
  } catch {
    return null;
  }
}

export function buildProspectMutationRedirect(input: {
  detailHref: string;
  returnTo: string;
  queueReturnTo: string | null;
  nextProspectSid: string | null;
  nextNotice: string;
  fallbackNotice: string;
}) {
  if (!input.queueReturnTo || !input.nextProspectSid) {
    return `${input.detailHref}&notice=${input.fallbackNotice}`;
  }

  return buildQueueContinuationHref({
    detailHref: input.detailHref,
    nextProspectSid: input.nextProspectSid,
    returnTo: input.returnTo,
    nextNotice: input.nextNotice,
    fallbackNotice: input.fallbackNotice
  });
}

type DetailActionContext = {
  prospectSid: string;
  detailHref: string;
  returnTo: string;
  queueReturnTo: string | null;
  prospectStatus: ProspectStatusValue;
};

type ShortcutMutationOptions = {
  status: string;
  nextActionAt: Date | null;
  attempt?: {
    channel: (typeof prospectAttemptChannels)[number];
    outcome: (typeof prospectAttemptOutcomes)[number];
    note: string;
  };
};

export function createProspectDetailActions(context: DetailActionContext) {
  async function saveWorkflow(formData: FormData, advanceToNext: boolean) {
    'use server';

    const bootstrap = await getBootstrap();
    const currentBusiness = bootstrap?.tenant?.businesses[0] ?? null;

    if (!currentBusiness) {
      redirect(`${context.detailHref}&notice=error`);
    }

    const status = String(formData.get('status') ?? '').trim();
    const priority = String(formData.get('priority') ?? '').trim();
    const notes = String(formData.get('notes') ?? '').trim();
    const nextActionAtValue = String(formData.get('nextActionAt') ?? '').trim();

    if (!status) {
      redirect(`${context.detailHref}&notice=error`);
    }

    const nextActionAt = nextActionAtValue ? new Date(nextActionAtValue) : null;

    if (nextActionAt && Number.isNaN(nextActionAt.getTime())) {
      redirect(`${context.detailHref}&notice=error`);
    }

    let response: Response;

    try {
      response = await fetch(
        `${getApiBaseUrl()}/v1/businesses/${currentBusiness.id}/prospects/${context.prospectSid}`,
        {
          method: 'PATCH',
          cache: 'no-store',
          headers: {
            ...getInternalApiHeaders(),
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            status,
            priority: priority ? priority : null,
            notes: notes ? notes : null,
            nextActionAt: normalizeProspectNextActionAt(status, nextActionAt)?.toISOString() ?? null
          })
        }
      );
    } catch {
      redirect(`${context.detailHref}&notice=error`);
    }

    if (!response.ok) {
      redirect(`${context.detailHref}&notice=error`);
    }

    revalidatePath(`/prospects/${context.prospectSid}`);

    if (advanceToNext && context.queueReturnTo) {
      const nextQueueContext = await resolveQueueContext(currentBusiness.id, context.prospectSid, context.queueReturnTo);

      redirect(
        buildProspectMutationRedirect({
          detailHref: context.detailHref,
          returnTo: context.returnTo,
          queueReturnTo: context.queueReturnTo,
          nextProspectSid: nextQueueContext?.nextProspectSid ?? null,
          nextNotice: 'saved-next',
          fallbackNotice: 'saved'
        })
      );
    }

    redirect(`${context.detailHref}&notice=saved`);
  }

  async function updateWorkflow(formData: FormData) {
    'use server';

    return saveWorkflow(formData, false);
  }

  async function updateWorkflowAndNext(formData: FormData) {
    'use server';

    return saveWorkflow(formData, true);
  }

  async function logAttemptMutation(formData: FormData, advanceToNext: boolean) {
    'use server';

    const bootstrap = await getBootstrap();
    const currentBusiness = bootstrap?.tenant?.businesses[0] ?? null;

    if (!currentBusiness) {
      redirect(`${context.detailHref}&notice=attempt-error`);
    }

    const channel = String(formData.get('channel') ?? '').trim();
    const outcome = String(formData.get('outcome') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();
    const attemptedAtValue = String(formData.get('attemptedAt') ?? '').trim();

    if (!channel || !outcome) {
      redirect(`${context.detailHref}&notice=attempt-error`);
    }

    const attemptedAt = attemptedAtValue ? new Date(attemptedAtValue) : new Date();

    if (Number.isNaN(attemptedAt.getTime())) {
      redirect(`${context.detailHref}&notice=attempt-error`);
    }

    let response: Response;

    try {
      response = await fetch(
        `${getApiBaseUrl()}/v1/businesses/${currentBusiness.id}/prospects/${context.prospectSid}/attempts`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            ...getInternalApiHeaders(),
            'content-type': 'application/json'
          },
            body: JSON.stringify({
              channel,
              outcome,
              note: note ? note : null,
              attemptedAt: attemptedAt.toISOString()
            })
          }
      );
    } catch {
      redirect(`${context.detailHref}&notice=attempt-error`);
    }

    if (!response.ok) {
      redirect(`${context.detailHref}&notice=attempt-error`);
    }

    revalidatePath(`/prospects/${context.prospectSid}`);

    if (advanceToNext && context.queueReturnTo) {
      const nextQueueContext = await resolveQueueContext(currentBusiness.id, context.prospectSid, context.queueReturnTo);

      redirect(
        buildProspectMutationRedirect({
          detailHref: context.detailHref,
          returnTo: context.returnTo,
          queueReturnTo: context.queueReturnTo,
          nextProspectSid: nextQueueContext?.nextProspectSid ?? null,
          nextNotice: 'attempt-saved-next',
          fallbackNotice: 'attempt-saved'
        })
      );
    }

    redirect(`${context.detailHref}&notice=attempt-saved`);
  }

  async function logAttempt(formData: FormData) {
    'use server';

    return logAttemptMutation(formData, false);
  }

  async function logAttemptAndNext(formData: FormData) {
    'use server';

    return logAttemptMutation(formData, true);
  }

  async function applyShortcutMutation(options: ShortcutMutationOptions, advanceToNext: boolean) {
    'use server';

    const bootstrap = await getBootstrap();
    const currentBusiness = bootstrap?.tenant?.businesses[0] ?? null;

    if (!currentBusiness) {
      redirect(`${context.detailHref}&notice=shortcut-error`);
    }

    if (options.attempt) {
      let attemptResponse: Response;

      try {
        attemptResponse = await fetch(
          `${getApiBaseUrl()}/v1/businesses/${currentBusiness.id}/prospects/${context.prospectSid}/attempts`,
          {
            method: 'POST',
            cache: 'no-store',
            headers: {
              ...getInternalApiHeaders(),
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              channel: options.attempt.channel,
              outcome: options.attempt.outcome,
              note: options.attempt.note,
              attemptedAt: new Date().toISOString()
            })
          }
        );
      } catch {
        redirect(`${context.detailHref}&notice=shortcut-error`);
      }

      if (!attemptResponse.ok) {
        redirect(`${context.detailHref}&notice=shortcut-error`);
      }
    }

    let updateResponse: Response;

    try {
      updateResponse = await fetch(
        `${getApiBaseUrl()}/v1/businesses/${currentBusiness.id}/prospects/${context.prospectSid}`,
        {
          method: 'PATCH',
          cache: 'no-store',
          headers: {
            ...getInternalApiHeaders(),
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            status: options.status,
            nextActionAt: normalizeProspectNextActionAt(options.status, options.nextActionAt)?.toISOString() ?? null
          })
        }
      );
    } catch {
      redirect(`${context.detailHref}&notice=shortcut-error`);
    }

    if (!updateResponse.ok) {
      redirect(`${context.detailHref}&notice=shortcut-error`);
    }

    revalidatePath(`/prospects/${context.prospectSid}`);

    if (advanceToNext && context.queueReturnTo) {
      const nextQueueContext = await resolveQueueContext(currentBusiness.id, context.prospectSid, context.queueReturnTo);

      redirect(
        buildProspectMutationRedirect({
          detailHref: context.detailHref,
          returnTo: context.returnTo,
          queueReturnTo: context.queueReturnTo,
          nextProspectSid: nextQueueContext?.nextProspectSid ?? null,
          nextNotice: 'shortcut-saved-next',
          fallbackNotice: 'shortcut-saved'
        })
      );
    }

    redirect(`${context.detailHref}&notice=shortcut-saved`);
  }

  async function noAnswerShortcut() {
    'use server';

    return applyShortcutMutation(getProspectShortcutTransition('no-answer', context.prospectStatus), false);
  }

  async function noAnswerShortcutAndNext() {
    'use server';

    return applyShortcutMutation(getProspectShortcutTransition('no-answer', context.prospectStatus), true);
  }

  async function voicemailShortcut() {
    'use server';

    return applyShortcutMutation(getProspectShortcutTransition('voicemail', context.prospectStatus), false);
  }

  async function voicemailShortcutAndNext() {
    'use server';

    return applyShortcutMutation(getProspectShortcutTransition('voicemail', context.prospectStatus), true);
  }

  async function updateStatusShortcut(nextStatus: string, advanceToNext: boolean) {
    'use server';

    return applyShortcutMutation(
      {
        status: nextStatus,
        nextActionAt: null
      },
      advanceToNext
    );
  }

  async function markResponded() {
    'use server';

    return updateStatusShortcut('RESPONDED', false);
  }

  async function markRespondedAndNext() {
    'use server';

    return updateStatusShortcut('RESPONDED', true);
  }

  async function markQualified() {
    'use server';

    return updateStatusShortcut('QUALIFIED', false);
  }

  async function markQualifiedAndNext() {
    'use server';

    return updateStatusShortcut('QUALIFIED', true);
  }

  async function markDisqualified() {
    'use server';

    return updateStatusShortcut('DISQUALIFIED', false);
  }

  async function markDisqualifiedAndNext() {
    'use server';

    return updateStatusShortcut('DISQUALIFIED', true);
  }

  async function archiveProspect() {
    'use server';

    return updateStatusShortcut('ARCHIVED', false);
  }

  async function archiveProspectAndNext() {
    'use server';

    return updateStatusShortcut('ARCHIVED', true);
  }

  return {
    updateWorkflow,
    updateWorkflowAndNext,
    logAttempt,
    logAttemptAndNext,
    noAnswerShortcut,
    noAnswerShortcutAndNext,
    voicemailShortcut,
    voicemailShortcutAndNext,
    markResponded,
    markRespondedAndNext,
    markQualified,
    markQualifiedAndNext,
    markDisqualified,
    markDisqualifiedAndNext,
    archiveProspect,
    archiveProspectAndNext
  };
}
