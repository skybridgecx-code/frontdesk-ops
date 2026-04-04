export const PROSPECT_QUEUE_FETCH_LIMIT = 200;

export type ProspectQueueStatus =
  | 'ALL'
  | 'NEW'
  | 'READY'
  | 'IN_PROGRESS'
  | 'ATTEMPTED'
  | 'RESPONDED'
  | 'QUALIFIED'
  | 'DISQUALIFIED'
  | 'ARCHIVED';

export type ProspectQueueRow = {
  prospectSid: string;
  nextActionAt?: string | null;
};

export const prospectQueueStatuses: ProspectQueueStatus[] = [
  'ALL',
  'NEW',
  'READY',
  'IN_PROGRESS',
  'ATTEMPTED',
  'RESPONDED',
  'QUALIFIED',
  'DISQUALIFIED',
  'ARCHIVED'
];

export function isProspectQueueStatus(value: string | null | undefined) {
  return prospectQueueStatuses.includes(value as ProspectQueueStatus);
}

export function getQueueStatusFromReturnTo(returnTo: string) {
  try {
    const url = new URL(returnTo, 'http://localhost');

    if (!url.pathname.startsWith('/prospects')) {
      return null;
    }

    const status = url.searchParams.get('status')?.toUpperCase() ?? null;
    return status && isProspectQueueStatus(status) ? status : null;
  } catch {
    return null;
  }
}

export function buildProspectsRequestUrl(input: {
  apiBaseUrl: string;
  businessId: string;
  status?: ProspectQueueStatus | null;
  limit?: number;
}) {
  const url = new URL(`${input.apiBaseUrl}/v1/businesses/${input.businessId}/prospects`);
  const limit = input.limit ?? PROSPECT_QUEUE_FETCH_LIMIT;
  url.searchParams.set('limit', String(limit));

  if (input.status && input.status !== 'ALL') {
    url.searchParams.set('status', input.status);
  }

  return url.toString();
}

export function buildProspectDetailHref(input: { prospectSid: string; returnTo: string }) {
  return `/prospects/${input.prospectSid}?returnTo=${encodeURIComponent(input.returnTo)}`;
}

export function buildQueueHref(status: ProspectQueueStatus) {
  const params = new URLSearchParams();

  if (status !== 'ALL') {
    params.set('status', status);
  }

  const query = params.toString();
  return query ? `/prospects?${query}` : '/prospects';
}

export function getQueueStateLabel(nextActionAt: string | null, nowMs = Date.now()) {
  if (!nextActionAt) {
    return 'no next action';
  }

  const nextActionTime = new Date(nextActionAt).getTime();

  if (Number.isNaN(nextActionTime)) {
    return 'no next action';
  }

  if (nextActionTime < nowMs) {
    return 'overdue';
  }

  if (nextActionTime <= nowMs + 24 * 60 * 60 * 1000) {
    return 'due now';
  }

  return 'upcoming';
}

export function findNextQueueProspectSid(
  queue: ProspectQueueRow[],
  currentProspectSid: string
) {
  const currentIndex = queue.findIndex((item) => item.prospectSid === currentProspectSid);

  if (currentIndex < 0 || currentIndex + 1 >= queue.length) {
    return null;
  }

  return queue[currentIndex + 1]?.prospectSid ?? null;
}

export function buildQueueContinuationHref(input: {
  detailHref: string;
  nextProspectSid: string | null;
  returnTo: string;
  nextNotice: string;
  fallbackNotice: string;
}) {
  if (input.nextProspectSid) {
    return `${buildProspectDetailHref({
      prospectSid: input.nextProspectSid,
      returnTo: input.returnTo
    })}&notice=${input.nextNotice}`;
  }

  return `${input.detailHref}&notice=${input.fallbackNotice}`;
}
