'use client';

import { useActionState, useState } from 'react';
import type { ProspectAttempt, ProspectDetail } from './prospect-detail-flow';
import {
  buildProspectOutreachSnapshot,
  initialProspectOutreachState,
  type ProspectOutreachDraft,
  type ProspectOutreachState
} from './outreach-copilot.shared';

const outreachGoalOptions = [
  { value: 'book_call', label: 'Book call' },
  { value: 'send_walkthrough', label: 'Send walkthrough' },
  { value: 'find_right_contact', label: 'Find right contact' }
] as const;

const outreachLengthOptions = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' }
] as const;

const outreachToneOptions = [
  { value: 'direct', label: 'Direct' },
  { value: 'warm', label: 'Warm' }
] as const;

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
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">{label}</div>
      <div
        className={`${monospace ? 'font-mono text-sm leading-6' : 'text-sm leading-7'} mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-gray-800`}
      >
        {value}
      </div>
    </div>
  );
}

function getPriorityBandLabel(value: ProspectOutreachDraft['priorityBand']) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildDraftCopyText(draft: ProspectOutreachDraft) {
  return [
    `Qualification score: ${draft.qualificationScore}/25 (${getPriorityBandLabel(draft.priorityBand)} priority)`,
    '',
    `Fit summary: ${draft.fitSummary}`,
    `Chosen angle: ${draft.chosenAngle}`,
    '',
    `First email subject: ${draft.firstEmailSubject}`,
    '',
    'First email body:',
    draft.firstEmailBody,
    '',
    'Short DM / text:',
    draft.shortDmText,
    '',
    'Follow-up 1:',
    draft.followUp1,
    '',
    'Follow-up 2:',
    draft.followUp2,
    '',
    'Call opener:',
    draft.callOpener,
    '',
    'CRM note:',
    draft.crmNote
  ].join('\n');
}

export function OutreachCopilotPanel({
  prospect,
  attempts,
  generateOutreachDraft,
  enabled,
  unavailableReason
}: OutreachCopilotPanelProps) {
  const [state, formAction, pending] = useActionState(generateOutreachDraft, initialProspectOutreachState);
  const [copied, setCopied] = useState(false);
  const snapshot = buildProspectOutreachSnapshot(prospect, attempts);
  const payload = JSON.stringify({ snapshot });
  const generatedDraft = state.draft;
  const statusMessage =
    state.status === 'error' && state.message
      ? state.message
      : state.status === 'success'
        ? state.message
        : null;

  async function copyDraftToClipboard() {
    if (!generatedDraft) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildDraftCopyText(generatedDraft));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="text-xs uppercase tracking-wide text-indigo-600">SkyBridgeCX copilot</div>
      <h2 className="mt-2 text-xl font-semibold text-gray-900">Outreach draft generator</h2>
      <p className="mt-2 max-w-3xl text-sm text-gray-600">
        Build operator-ready outreach drafts from the latest prospect profile and attempt history.
      </p>

      {!enabled && unavailableReason ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unavailableReason}
        </div>
      ) : null}

      <form action={formAction} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <input type="hidden" name="prospectSnapshot" value={payload} />

        <label className="space-y-2 text-sm text-gray-600">
          <span className="font-medium text-gray-700">Goal</span>
          <select
            name="outreachGoal"
            defaultValue="book_call"
            className="min-h-11 w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            {outreachGoalOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-gray-600">
          <span className="font-medium text-gray-700">Length</span>
          <select
            name="outreachLength"
            defaultValue="short"
            className="min-h-11 w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            {outreachLengthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-gray-600">
          <span className="font-medium text-gray-700">Tone</span>
          <select
            name="outreachTone"
            defaultValue="direct"
            className="min-h-11 w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            {outreachToneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!enabled || pending}
            className="min-h-11 w-full rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </form>

      {statusMessage ? (
        <div
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            state.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {statusMessage}
        </div>
      ) : null}

      {generatedDraft ? (
        <div className="mt-6 grid gap-4">
          <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-gray-700">Generated draft</p>
            <button
              type="button"
              onClick={copyDraftToClipboard}
              className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50 sm:w-auto"
            >
              {copied ? 'Copied' : 'Copy full draft'}
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-gray-200 bg-indigo-50 p-4">
              <div className="text-sm uppercase tracking-wide text-indigo-700 sm:text-xs">Qualification score</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                {generatedDraft.qualificationScore}/25
              </div>
              <div className="mt-1 text-sm text-gray-700">{getPriorityBandLabel(generatedDraft.priorityBand)} priority</div>
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
            <div className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">
              Generated{' '}
              {new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
              }).format(new Date(state.generatedAt))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
