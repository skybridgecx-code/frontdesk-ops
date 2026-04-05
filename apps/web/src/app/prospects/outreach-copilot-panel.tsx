'use client';

import { useActionState } from 'react';
import type { ProspectAttempt, ProspectDetail } from './prospect-detail-flow';
import {
  buildProspectOutreachSnapshot,
  initialProspectOutreachState,
  type ProspectOutreachDraft,
  type ProspectOutreachState
} from './outreach-copilot.shared';

type OutreachCopilotAction = (
  previousState: ProspectOutreachState,
  formData: FormData
) => Promise<ProspectOutreachState>;

type OutreachCopilotPanelProps = {
  prospect: Pick<
    ProspectDetail,
    | 'prospectSid'
    | 'companyName'
    | 'contactName'
    | 'contactPhone'
    | 'contactEmail'
    | 'city'
    | 'state'
    | 'sourceLabel'
    | 'status'
    | 'priority'
    | 'serviceInterest'
    | 'notes'
    | 'nextActionAt'
    | 'lastAttemptAt'
  >;
  attempts: ProspectAttempt[];
  generateOutreachDraft: OutreachCopilotAction;
  enabled: boolean;
  unavailableReason: string | null;
};

function OutputBlock({
  label,
  value,
  monospace = false
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.22em] text-black/40">{label}</div>
      <div className={`${monospace ? 'font-mono text-[13px] leading-6' : 'text-sm leading-7'} mt-2 whitespace-pre-wrap text-black`}>
        {value}
      </div>
    </div>
  );
}

function getPriorityBandLabel(value: ProspectOutreachDraft['priorityBand']) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function OutreachCopilotPanel({
  prospect,
  attempts,
  generateOutreachDraft,
  enabled,
  unavailableReason
}: OutreachCopilotPanelProps) {
  const [state, formAction, pending] = useActionState(generateOutreachDraft, initialProspectOutreachState);
  const snapshot = buildProspectOutreachSnapshot(prospect, attempts);
  const payload = JSON.stringify({ snapshot });
  const generatedDraft = state.draft;
  const statusMessage =
    state.status === 'error' && state.message
      ? state.message
      : state.status === 'success'
        ? state.message
        : null;

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="text-xs uppercase tracking-[0.24em] text-black/50">Outreach copilot</div>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Generate a structured outreach package</h2>
      <p className="mt-2 max-w-3xl text-sm text-black/60">
        This uses the current prospect record, notes, and recent attempts to draft operator-reviewed outreach. No
        sending, no external CRM sync, and no browser-exposed model credentials.
      </p>

      {!enabled && unavailableReason ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unavailableReason}
        </div>
      ) : null}

      <form action={formAction} className="mt-5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="prospectSnapshot" value={payload} />
        <button
          type="submit"
          disabled={!enabled || pending}
          className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Generating…' : 'Generate outreach package'}
        </button>
        <p className="text-sm text-black/55">
          Fit summary, angle, email, DM, follow-ups, call opener, and CRM note.
        </p>
      </form>

      {statusMessage ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            state.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {statusMessage}
        </div>
      ) : null}

      {generatedDraft ? (
        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-[#f8faf8] p-4 shadow-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Qualification score</div>
              <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-black">
                {generatedDraft.qualificationScore}/25
              </div>
              <div className="mt-1 text-sm text-black/60">{getPriorityBandLabel(generatedDraft.priorityBand)} priority</div>
            </div>

            <OutputBlock label="Fit summary" value={generatedDraft.fitSummary} />
            <OutputBlock label="Chosen angle" value={generatedDraft.chosenAngle} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <OutputBlock label="First email subject" value={generatedDraft.firstEmailSubject} />
            <OutputBlock label="Short DM / text" value={generatedDraft.shortDmText} />
          </div>

          <OutputBlock label="First email body" value={generatedDraft.firstEmailBody} />

          <div className="grid gap-4 lg:grid-cols-2">
            <OutputBlock label="Follow-up 1" value={generatedDraft.followUp1} />
            <OutputBlock label="Follow-up 2" value={generatedDraft.followUp2} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <OutputBlock label="Call opener" value={generatedDraft.callOpener} />
            <OutputBlock label="CRM note" value={generatedDraft.crmNote} />
          </div>

          {state.generatedAt ? (
            <div className="text-xs uppercase tracking-[0.22em] text-black/40">
              Generated {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.generatedAt))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
