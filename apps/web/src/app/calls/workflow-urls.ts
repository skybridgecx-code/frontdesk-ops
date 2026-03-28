export type CallsFilterInput = {
  triageStatus?: string;
  reviewStatus?: string;
  urgency?: string;
  q?: string;
  page?: string;
  limit?: string;
  notice?: string;
};

export function normalizeLimit(value: string | undefined) {
  return String(Math.min(Math.max(Number(value ?? '25') || 25, 1), 100));
}

export function normalizePage(value: string | undefined) {
  return String(Math.max(Number(value ?? '1') || 1, 1));
}

export function buildFilterHref(input: CallsFilterInput) {
  const params = new URLSearchParams();

  if (input.triageStatus) params.set('triageStatus', input.triageStatus);
  if (input.reviewStatus) params.set('reviewStatus', input.reviewStatus);
  if (input.urgency) params.set('urgency', input.urgency);
  if (input.q?.trim()) params.set('q', input.q.trim());

  const normalizedPage = normalizePage(input.page);
  if (normalizedPage !== '1') params.set('page', normalizedPage);

  const normalizedLimit = normalizeLimit(input.limit);
  if (normalizedLimit !== '25') params.set('limit', normalizedLimit);
  if (input.notice) params.set('notice', input.notice);

  const query = params.toString();
  return query ? `/calls?${query}` : '/calls';
}

export function buildNoticeHref(currentHref: string, notice: string) {
  const url = new URL(currentHref, 'http://localhost');
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}`;
}

export function buildQueueReviewNextRequestHref(currentHref: string) {
  const currentUrl = new URL(currentHref, 'http://localhost');
  const params = new URLSearchParams();

  for (const key of ['triageStatus', 'reviewStatus', 'urgency', 'q'] as const) {
    const value = currentUrl.searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/v1/calls/review-next?${query}` : '/v1/calls/review-next';
}

export function buildCallDetailHref(callSid: string, currentHref: string) {
  return `/calls/${callSid}?returnTo=${encodeURIComponent(currentHref)}`;
}

export function normalizeReturnTo(returnTo: string | undefined) {
  return returnTo && returnTo.startsWith('/calls') ? returnTo : '/calls?triageStatus=OPEN';
}

export function buildQueueNoticeHref(returnTo: string, notice: string) {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}`;
}

export function buildDetailReviewNextRequestHref(returnTo: string, excludeCallSid: string) {
  const returnToUrl = new URL(returnTo, 'http://localhost');
  const params = new URLSearchParams();
  params.set('excludeCallSid', excludeCallSid);

  for (const key of ['triageStatus', 'reviewStatus', 'urgency', 'q'] as const) {
    const value = returnToUrl.searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  }

  return `/v1/calls/review-next?${params.toString()}`;
}

export function buildSaveAndNextHref(nextCallSid: string, returnTo: string) {
  return `/calls/${nextCallSid}?returnTo=${encodeURIComponent(returnTo)}&notice=saved-next`;
}
