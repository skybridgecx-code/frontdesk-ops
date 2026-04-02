export { normalizeLimit, normalizePage } from '../operator-workflow';
import { buildNoticeHref, normalizeLimit, normalizePage } from '../operator-workflow';

export type ProspectsFilterInput = {
  tenantId?: string;
  businessId?: string;
  status?: string;
  priority?: string;
  q?: string;
  page?: string;
  limit?: string;
};

export function buildFilterHref(input: ProspectsFilterInput) {
  const params = new URLSearchParams();

  if (input.tenantId) params.set('tenantId', input.tenantId);
  if (input.businessId) params.set('businessId', input.businessId);
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
  const currentUrl = new URL(currentHref, 'http://localhost');
  const params = new URLSearchParams();
  const tenantId = currentUrl.searchParams.get('tenantId');
  const businessId = currentUrl.searchParams.get('businessId');

  if (tenantId) {
    params.set('tenantId', tenantId);
  }

  if (businessId) {
    params.set('businessId', businessId);
  }

  params.set('returnTo', currentHref);

  return `/prospects/${prospectSid}?${params.toString()}`;
}

export function normalizeReturnTo(returnTo: string | undefined, fallbackHref: string) {
  return returnTo && returnTo.startsWith('/prospects') ? returnTo : fallbackHref;
}

export function buildQueueNoticeHref(
  returnTo: string,
  notice: string,
  extras?: Record<string, string | null | undefined>
) {
  return buildNoticeHref(returnTo, notice, extras);
}

export function buildQueueReviewNextRequestHref(currentHref: string) {
  const currentUrl = new URL(currentHref, 'http://localhost');
  const params = new URLSearchParams();

  for (const key of ['tenantId', 'businessId', 'status', 'priority', 'q'] as const) {
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

  for (const key of ['tenantId', 'businessId', 'status', 'priority', 'q'] as const) {
    const value = returnToUrl.searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  }

  return `/v1/prospects/review-next?${params.toString()}`;
}

export function buildSaveAndNextHref(nextProspectSid: string, returnTo: string) {
  const returnToUrl = new URL(returnTo, 'http://localhost');
  const params = new URLSearchParams();
  const tenantId = returnToUrl.searchParams.get('tenantId');
  const businessId = returnToUrl.searchParams.get('businessId');

  if (tenantId) {
    params.set('tenantId', tenantId);
  }

  if (businessId) {
    params.set('businessId', businessId);
  }

  params.set('returnTo', returnTo);
  params.set('notice', 'saved-next');

  return `/prospects/${nextProspectSid}?${params.toString()}`;
}
