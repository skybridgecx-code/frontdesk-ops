import Link from 'next/link';
import {
  createProspectDetailActions,
  formatDateTime,
  formatDateTimeLocalInput,
  formatDateTimeLocalNow,
  formatLabel,
  getAttempts,
  getBootstrap,
  getProspect,
  getProspectDetailNotice,
  prospectAttemptChannels,
  prospectAttemptOutcomes,
  prospectPriorities,
  prospectStatuses,
  resolveQueueContext
} from '../prospect-detail-flow';
import { buildProspectDetailHref } from '../queue-flow';
import { buildProspectActivityTimeline } from '../prospect-activity-timeline';
import type { ProspectStatusValue } from '@frontdesk/domain';

export const dynamic = 'force-dynamic';

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
      <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Prospect detail</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">No active business configured</h1>
          <p className="mt-2 text-sm text-black/60">
            Prospect detail cannot load until an active business is available.
          </p>
          <Link
            href={returnTo}
            className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm"
          >
            Back to queue
          </Link>
        </div>
      </main>
    );
  }

  const detailResponse = await getProspect(activeBusiness.id, prospectSid);

  if (!detailResponse) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Prospect detail</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Prospect not found</h1>
          <p className="mt-2 text-sm text-black/60">
            We could not find that prospect for the active business.
          </p>
          <Link
            href={returnTo}
            className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm"
          >
            Back to queue
          </Link>
        </div>
      </main>
    );
  }

  const prospect = detailResponse.prospect;
  const attemptsResponse = await getAttempts(activeBusiness.id, prospectSid);
  const activityTimeline = buildProspectActivityTimeline(prospect, attemptsResponse.attempts);
  const queueContext = await resolveQueueContext(activeBusiness.id, prospectSid, queueReturnTo);
  const title = prospect.contactName || prospect.companyName || prospect.prospectSid;
  const metadataLine = [prospect.prospectSid, activeBusiness.name].filter(Boolean).join(' • ');
  const detailHref = buildProspectDetailHref({
    prospectSid,
    returnTo
  });
  const nextHref = queueContext?.nextHref ?? null;
  const attemptedAtDefaultValue = formatDateTimeLocalNow();
  const {
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
  } = createProspectDetailActions({
    prospectSid,
    detailHref,
    returnTo,
    queueReturnTo,
    prospectStatus: prospect.status as ProspectStatusValue
  });

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href={returnTo} className="text-sm font-medium text-[#6b7280] transition hover:text-[#111827]">
              ← Back to queue
            </Link>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{title}</h1>
            <p className="mt-2 text-sm text-black/60">{metadataLine}</p>
          </div>

          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]"
            >
              Next in queue
              <span className="ml-2" aria-hidden="true">
                →
              </span>
            </Link>
          ) : null}
        </div>

        {noticeMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              positiveNotice ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {noticeMessage}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-black/50">Prospect overview</div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Company</dt>
                <dd className="mt-1 text-sm text-black">{prospect.companyName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Contact</dt>
                <dd className="mt-1 text-sm text-black">{prospect.contactName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Phone</dt>
                <dd className="mt-1 text-sm text-black">{prospect.contactPhone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Email</dt>
                <dd className="mt-1 text-sm text-black">{prospect.contactEmail || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">City</dt>
                <dd className="mt-1 text-sm text-black">{prospect.city || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">State</dt>
                <dd className="mt-1 text-sm text-black">{prospect.state || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Source</dt>
                <dd className="mt-1 text-sm text-black">{prospect.sourceLabel || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-black/50">Workflow / status</div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Status</dt>
                <dd className="mt-1 text-sm text-black">{formatLabel(prospect.status)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Priority</dt>
                <dd className="mt-1 text-sm text-black">{formatLabel(prospect.priority)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Next action</dt>
                <dd className="mt-1 text-sm text-black">{formatDateTime(prospect.nextActionAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Last attempt</dt>
                <dd className="mt-1 text-sm text-black">{formatDateTime(prospect.lastAttemptAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Queue state</dt>
                <dd className="mt-1 text-sm text-black">{prospect.readState.queueStateLabel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Created</dt>
                <dd className="mt-1 text-sm text-black">{formatDateTime(prospect.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Updated</dt>
                <dd className="mt-1 text-sm text-black">{formatDateTime(prospect.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Update workflow</div>
          <p className="mt-2 text-sm text-black/60">
            Update the prospect record directly, then return to the same detail view.
          </p>

          <form action={updateWorkflow} className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <div className="text-xs uppercase tracking-[0.22em] text-black/40">Status</div>
                <select
                  name="status"
                  defaultValue={prospect.status}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                >
                  {prospectStatuses.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <div className="text-xs uppercase tracking-[0.22em] text-black/40">Priority</div>
                <select
                  name="priority"
                  defaultValue={prospect.priority ?? ''}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
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

            <label className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Notes</div>
              <textarea
                name="notes"
                defaultValue={prospect.notes ?? ''}
                rows={5}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                placeholder="Add context for the operator team."
              />
            </label>

            <label className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Next action</div>
              <input
                name="nextActionAt"
                type="datetime-local"
                defaultValue={formatDateTimeLocalInput(prospect.nextActionAt)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-sm text-black/60">Changes save to the backend and return here with a notice.</p>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                  Save workflow
                </button>
                <button
                  formAction={updateWorkflowAndNext}
                  className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]"
                >
                  Save and next
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Log attempt</div>
          <p className="mt-2 text-sm text-black/60">
            Record outreach activity so the next operator sees a clean history.
          </p>

          <form action={logAttempt} className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <div className="text-xs uppercase tracking-[0.22em] text-black/40">Channel</div>
                <select
                  name="channel"
                  defaultValue="CALL"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                >
                  {prospectAttemptChannels.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <div className="text-xs uppercase tracking-[0.22em] text-black/40">Outcome</div>
                <select
                  name="outcome"
                  defaultValue="LEFT_VOICEMAIL"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                >
                  {prospectAttemptOutcomes.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Note</div>
              <textarea
                name="note"
                rows={4}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                placeholder="Left voicemail and requested a callback after 3 pm."
              />
            </label>

            <label className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Attempted at</div>
              <input
                name="attemptedAt"
                type="datetime-local"
                defaultValue={attemptedAtDefaultValue}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
              />
            </label>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <button className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                Save attempt
              </button>
              <button
                formAction={logAttemptAndNext}
                className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]"
              >
                Log and next
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Disposition shortcuts</div>
          <p className="mt-2 text-sm text-black/60">
            Apply the most common outcomes directly when the call is already clear.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">No answer</div>
              <p className="mt-1 text-sm text-black/60">Logs a call attempt and schedules follow-up.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={noAnswerShortcut}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    No answer
                  </button>
                </form>
                {nextHref ? (
                  <form action={noAnswerShortcutAndNext}>
                    <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                      No answer and next
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">Left voicemail</div>
              <p className="mt-1 text-sm text-black/60">Logs the voicemail and schedules the next touch.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={voicemailShortcut}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    Left voicemail
                  </button>
                </form>
                {nextHref ? (
                  <form action={voicemailShortcutAndNext}>
                    <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                      Voicemail and next
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">Responded</div>
              <p className="mt-1 text-sm text-black/60">Marks the prospect as replied and clears the queue signal.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={markResponded}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    Responded
                  </button>
                </form>
                {nextHref ? (
                  <form action={markRespondedAndNext}>
                    <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                      Responded and next
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">Qualified</div>
              <p className="mt-1 text-sm text-black/60">Marks the prospect qualified and clears scheduling.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={markQualified}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    Qualified
                  </button>
                </form>
                {nextHref ? (
                  <form action={markQualifiedAndNext}>
                    <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                      Qualified and next
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">Disqualified / archive</div>
              <p className="mt-1 text-sm text-black/60">Clears the queue and marks the record closed.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={markDisqualified}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    Disqualified
                  </button>
                </form>
                <form action={archiveProspect}>
                  <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                    Archive
                  </button>
                </form>
                {nextHref ? (
                  <>
                    <form action={markDisqualifiedAndNext}>
                      <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                        Disqualified and next
                      </button>
                    </form>
                    <form action={archiveProspectAndNext}>
                      <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                        Archive and next
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Notes</div>
          <div className="mt-4 text-sm leading-7 text-black/80">
            {prospect.notes ? prospect.notes : 'No notes recorded.'}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 px-6 py-5">
            <div className="text-xs uppercase tracking-[0.24em] text-black/50">Activity timeline</div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Attempts plus current record snapshot</h2>
            <p className="mt-2 max-w-3xl text-sm text-black/60">
              Attempts below are real backend events. The snapshot shows the current prospect state because the system
              does not keep a full field-change audit trail yet.
            </p>
          </div>

          {activityTimeline.length === 0 ? (
            <div className="px-6 py-8 text-sm text-black/60">No activity recorded.</div>
          ) : (
            <div className="space-y-4 p-6">
              {activityTimeline.map((entry) => (
                <article
                  key={entry.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    entry.kind === 'snapshot' ? 'border-amber-200 bg-amber-50' : 'border-black/10 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-black/45">{entry.eventTypeLabel}</div>
                      <h3 className="mt-1 text-sm font-medium text-black">{entry.description}</h3>
                    </div>
                    <time className="shrink-0 text-xs uppercase tracking-[0.16em] text-black/40">
                      {formatDateTime(entry.timestamp)}
                    </time>
                  </div>
                  <p className="mt-3 text-sm text-black/70">{entry.detail}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
