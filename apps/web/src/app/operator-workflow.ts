export function normalizeLimit(value: string | undefined) {
  return String(Math.min(Math.max(Number(value ?? '25') || 25, 1), 100));
}

export function normalizePage(value: string | undefined) {
  return String(Math.max(Number(value ?? '1') || 1, 1));
}

export function buildNoticeHref(
  currentHref: string,
  notice: string,
  extras?: Record<string, string | null | undefined>
) {
  const url = new URL(currentHref, 'http://localhost');
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

export function buildQueueContextSummary(input: {
  currentHref: string;
  fallbackLabel: string;
  formatters?: Record<string, (value: string | undefined) => string | null>;
}) {
  const url = new URL(input.currentHref, 'http://localhost');
  const parts = Object.entries(input.formatters ?? {})
    .map(([key, formatter]) => formatter(url.searchParams.get(key) ?? undefined))
    .filter((value): value is string => Boolean(value));

  const q = url.searchParams.get('q')?.trim();
  if (q) {
    parts.push(`Search: "${q}"`);
  }

  const page = url.searchParams.get('page');
  if (page && page !== '1') {
    parts.push(`Page ${page}`);
  }

  return parts.length > 0 ? parts.join(' • ') : input.fallbackLabel;
}

export function getWorkItemSaveNoticeMessage(input: {
  notice: string | undefined;
  itemSingular: string;
  itemPlural: string;
}) {
  switch (input.notice) {
    case 'saved':
      return 'Changes saved.';
    case 'saved-next':
      return `Changes saved. Moved to the next ${input.itemSingular} needing attention.`;
    case `no-review-${input.itemPlural}`:
      return `Changes saved. No more ${input.itemPlural} need attention.`;
    default:
      return null;
  }
}

export function getWorkItemDetailNoticeMessage(input: {
  notice: string | undefined;
  itemSingular: string;
  itemPlural: string;
  customMessages?: Record<string, string>;
}) {
  const customMessage = input.notice ? input.customMessages?.[input.notice] : null;
  if (customMessage) {
    return customMessage;
  }

  return getWorkItemSaveNoticeMessage({
    notice: input.notice,
    itemSingular: input.itemSingular,
    itemPlural: input.itemPlural
  });
}

export function buildDetailNoticeHref(detailHref: string, notice: string) {
  const url = new URL(detailHref, 'http://localhost');
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}`;
}

export function resolveReviewNextDetailHref(input: {
  currentItemId: string;
  nextItemId: string | null;
  returnTo: string;
  noReviewNotice: string;
  buildQueueNoticeHref: (returnTo: string, notice: string) => string;
  buildSaveAndNextHref: (nextItemId: string, returnTo: string) => string;
}) {
  if (!input.nextItemId || input.nextItemId === input.currentItemId) {
    return input.buildQueueNoticeHref(input.returnTo, input.noReviewNotice);
  }

  return input.buildSaveAndNextHref(input.nextItemId, input.returnTo);
}
