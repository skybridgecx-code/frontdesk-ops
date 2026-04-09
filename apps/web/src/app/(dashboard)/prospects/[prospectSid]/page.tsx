import type { Metadata } from 'next';
import Link from 'next/link';
import {
  createProspectDetailActions,
  formatDateTime,
  formatDateTimeLocalInput,
  formatLabel,
  getAttempts,
  getBootstrap,
  getProspect,
  getProspectDetailNotice,
  prospectPriorities,
  prospectStatuses,
  resolveQueueContext
} from '../prospect-detail-flow';
import { buildProspectActivityTimeline } from '../prospect-activity-timeline';
import { generateProspectOutreachDraftAction, getProspectOutreachAvailability } from '../outreach-copilot.server';
import { OutreachCopilotPanel } from '../outreach-copilot-panel';
import { Breadcrumb } from '../../components/breadcrumb';
import { Card } from '../../components/card';
import { EmptyState } from '../../components/empty-state';
import { StatusBadge } from '../../components/status-badge';
import type { ProspectStatusValue } from '@frontdesk/domain';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ prospectSid: string }>;
}): Promise<Metadata> {
  const { prospectSid } = await params;

  return {
    title: `Prospect ${prospectSid} | SkybridgeCX`
  };
}

export default async function ProspectDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ prospectSid: string }>;
  searchParams: Promise<{ notice?: string; returnTo?: string }>;
}) {
  const { prospectSid } = await params;
  const resolvedSearchParams = await searchParams;
  const bootstrap = await getBootstrap();
  const activeBusiness = bootstrap?.tenant?.businesses[0] ?? null;
  const queueReturnTo =
    resolvedSearchParams.returnTo && resolvedSearchParams.returnTo.startsWith('/prospects')
      ? resolvedSearchParams.returnTo
      : null;
  const returnTo = queueReturnTo ?? '/prospects';
  const noticeMessage = getProspectDetailNotice(resolvedSearchParams.notice);
  const positiveNotice = new Set([
    'saved',
    'saved-next',
    'attempt-saved',
    'attempt-saved-next',
    'shortcut-saved',
    'shortcut-saved-next'
  ]).has(resolvedSearchParams.notice ?? '');

  if (!activeBusiness) {
    return (
      <EmptyState
        title="No active business configured"
        description="Prospect detail cannot load until an active business is available."
        actionLabel="Back to prospects"
        actionHref={returnTo}
      />
    );
  }

  const detailResponse = await getProspect(activeBusiness.id, prospectSid);

  if (!detailResponse) {
    return (
      <EmptyState
        title="Prospect not found"
        description="We could not find that prospect for the active business."
        actionLabel="Back to prospects"
        actionHref={returnTo}
      />
    );
  }

  const prospect = detailResponse.prospect;
  const attemptsResponse = await getAttempts(activeBusiness.id, prospectSid);
  const activityTimeline = buildProspectActivityTimeline(prospect, attemptsResponse.attempts);
  const queueContext = await resolveQueueContext(activeBusiness.id, prospectSid, queueReturnTo);
  const outreachAvailability = await getProspectOutreachAvailability();
  const detailHref = `/prospects/${prospectSid}?returnTo=${encodeURIComponent(returnTo)}`;
  const nextHref = queueContext?.nextHref ?? null;

  const {
    updateWorkflow,
    updateWorkflowAndNext,
    markResponded,
    markRespondedAndNext,
    markQualified,
    markQualifiedAndNext,
    markDisqualified,
    markDisqualifiedAndNext,
    archiveProspect,
    archiveProspectAndNext
  } = createProspectDetailActions({
    prospectSid,
    detailHref,
    returnTo,
    queueReturnTo,
    prospectStatus: prospect.status as ProspectStatusValue
  });

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Prospects', href: returnTo },
          { label: prospect.companyName ?? prospect.contactName ?? prospect.prospectSid }
        ]}
      />

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href={returnTo} className="inline-flex min-h-11 items-center text-sm font-medium text-gray-500 transition hover:text-indigo-600">
              ← Back to prospects list
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              {prospect.companyName ?? prospect.contactName ?? prospect.prospectSid}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge value={prospect.status} type="prospect" />
              <StatusBadge value={prospect.priority ?? 'none'} type="prospect" fallback="No priority" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {nextHref ? (
              <Link
                href={nextHref}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50 sm:w-auto"
              >
                Next in queue
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {noticeMessage ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            positiveNotice ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {noticeMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card title="Contact info" subtitle="Core lead details captured by SkybridgeCX.">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">Company</dt>
                <dd className="mt-1 text-sm text-gray-900">{prospect.companyName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">Contact</dt>
                <dd className="mt-1 text-sm text-gray-900">{prospect.contactName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{prospect.contactPhone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{prospect.contactEmail ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">City</dt>
                <dd className="mt-1 text-sm text-gray-900">{prospect.city ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">State</dt>
                <dd className="mt-1 text-sm text-gray-900">{prospect.state ?? '—'}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Notes and workflow" subtitle="Edit notes, status, and next action scheduling.">
            <form action={updateWorkflow} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Status</span>
                  <select
                    name="status"
                    defaultValue={prospect.status}
                    className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  >
                    {prospectStatuses.map((value) => (
                      <option key={value} value={value}>
                        {formatLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Priority</span>
                  <select
                    name="priority"
                    defaultValue={prospect.priority ?? ''}
                    className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">No priority</option>
                    {prospectPriorities.map((value) => (
                      <option key={value} value={value}>
                        {formatLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">Next action</span>
                <input
                  name="nextActionAt"
                  type="datetime-local"
                  defaultValue={formatDateTimeLocalInput(prospect.nextActionAt)}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">Notes</span>
                <textarea
                  name="notes"
                  rows={6}
                  defaultValue={prospect.notes ?? ''}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                <button
                  type="submit"
                  className="min-h-11 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Save workflow
                </button>
                <button
                  formAction={updateWorkflowAndNext}
                  className="min-h-11 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50"
                >
                  Save and next
                </button>
              </div>
            </form>
          </Card>

          <OutreachCopilotPanel
            prospect={prospect}
            attempts={attemptsResponse.attempts}
            generateOutreachDraft={generateProspectOutreachDraftAction}
            enabled={outreachAvailability.enabled}
            unavailableReason={outreachAvailability.unavailableReason}
          />
        </div>

        <div className="space-y-6">
          <Card title="Attempt history" subtitle="Most recent outreach attempts logged by operators.">
            {attemptsResponse.attempts.length === 0 ? (
              <p className="text-sm text-gray-600">No attempts logged yet.</p>
            ) : (
              <ul className="space-y-3">
                {attemptsResponse.attempts.map((attempt) => (
                  <li key={attempt.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-900">
                      {formatLabel(attempt.channel)} · {formatLabel(attempt.outcome)}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 sm:text-xs">{formatDateTime(attempt.attemptedAt)}</p>
                    <p className="mt-2 text-sm text-gray-600">{attempt.note ?? 'No note provided.'}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Activity timeline" subtitle="Record snapshots and attempt events in chronological order.">
            {activityTimeline.length === 0 ? (
              <p className="text-sm text-gray-600">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {activityTimeline.map((entry) => (
                  <li
                    key={entry.id}
                    className={`rounded-md border p-3 ${
                      entry.kind === 'snapshot' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900">{entry.eventTypeLabel}</p>
                      <p className="text-sm text-gray-500 sm:text-xs">{formatDateTime(entry.timestamp)}</p>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">{entry.description}</p>
                    <p className="mt-2 text-sm text-gray-600">{entry.detail ?? '—'}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Quick disposition" subtitle="Apply common outcomes from the detail view.">
            <div className="grid gap-2">
              <form action={markResponded}>
                <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                  Mark responded
                </button>
              </form>
              {nextHref ? (
                <form action={markRespondedAndNext}>
                  <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                    Mark responded and next
                  </button>
                </form>
              ) : null}
              <form action={markQualified}>
                <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                  Mark qualified
                </button>
              </form>
              {nextHref ? (
                <form action={markQualifiedAndNext}>
                  <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                    Mark qualified and next
                  </button>
                </form>
              ) : null}
              <form action={markDisqualified}>
                <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                  Mark disqualified
                </button>
              </form>
              {nextHref ? (
                <form action={markDisqualifiedAndNext}>
                  <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                    Mark disqualified and next
                  </button>
                </form>
              ) : null}
              <form action={archiveProspect}>
                <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                  Archive prospect
                </button>
              </form>
              {nextHref ? (
                <form action={archiveProspectAndNext}>
                  <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                    Archive and next
                  </button>
                </form>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
