export type ProspectsFilterInput = {
  status?: string;
  priority?: string;
  q?: string;
  page?: string;
  limit?: string;
};

export function normalizeLimit(value: string | undefined) {
  return String(Math.min(Math.max(Number(value ?? '25') || 25, 1), 100));
}

export function normalizePage(value: string | undefined) {
  return String(Math.max(Number(value ?? '1') || 1, 1));
}

export function buildFilterHref(input: ProspectsFilterInput) {
  const params = new URLSearchParams();

  if (input.status) params.set('status', input.status);
  if (input.priority) params.set('priority', input.priority);
  if (input.q?.trim()) params.set('q', input.q.trim());

  const normalizedPage = normalizePage(input.page);
  if (normalizedPage !== '1') params.set('page', normalizedPage);

  const normalizedLimit = normalizeLimit(input.limit);
  if (normalizedLimit !== '25') params.set('limit', normalizedLimit);

  const query = params.toString();
  return query ? `/prospects?${query}` : '/prospects';
}

export function buildProspectDetailHref(prospectSid: string, currentHref: string) {
  return `/prospects/${prospectSid}?returnTo=${encodeURIComponent(currentHref)}`;
}

export function normalizeReturnTo(returnTo: string | undefined) {
  return returnTo && returnTo.startsWith('/prospects') ? returnTo : '/prospects?status=READY';
}

export function buildQueueNoticeHref(
  returnTo: string,
  notice: string,
  extras?: Record<string, string | null | undefined>
) {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.set('notice', notice);

  for (const [key, value] of Object.entries(extras ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  }

  return `${url.pathname}${url.search}`;
}

export function buildQueueReviewNextRequestHref(currentHref: string) {
  const currentUrl = new URL(currentHref, 'http://localhost');
  const params = new URLSearchParams();

  for (const key of ['status', 'priority', 'q'] as const) {
    const value = currentUrl.searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/v1/prospects/review-next?${query}` : '/v1/prospects/review-next';
}

export function buildDetailReviewNextRequestHref(returnTo: string, excludeProspectSid: string) {
  const returnToUrl = new URL(returnTo, 'http://localhost');
  const params = new URLSearchParams();
  params.set('excludeProspectSid', excludeProspectSid);

  for (const key of ['status', 'priority', 'q'] as const) {
    const value = returnToUrl.searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  }

  return `/v1/prospects/review-next?${params.toString()}`;
}

export function buildSaveAndNextHref(nextProspectSid: string, returnTo: string) {
  return `/prospects/${nextProspectSid}?returnTo=${encodeURIComponent(returnTo)}&notice=saved-next`;
}
