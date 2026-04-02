'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LOCAL_DRAFT_LABEL,
  buildLocalDraftStorageKey,
  clearLocalRecordDraft,
  consumePendingDraftClear,
  hasLocalDraftChanges,
  mergeDraftValues,
  readLocalRecordDraft,
  restorePendingDraftClear,
  stagePendingDraftClear,
  writeLocalRecordDraft
} from '@/app/local-record-draft';

type ProspectUpdateValues = {
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  state: string;
  sourceLabel: string;
  nextActionAt: string;
  status: string;
  priority: string;
  serviceInterest: string;
  notes: string;
};

type Props = {
  prospectSid: string;
  notice?: string;
  initialValues: ProspectUpdateValues;
  saveAction: (formData: FormData) => void | Promise<void>;
  saveAndReviewNextAction: (formData: FormData) => void | Promise<void>;
};

const CLEAR_NOTICES = ['saved', 'saved-next', 'no-review-prospects'] as const;

export function ProspectUpdateForm({
  prospectSid,
  notice,
  initialValues,
  saveAction,
  saveAndReviewNextAction
}: Props) {
  const storageKey = buildLocalDraftStorageKey('prospect', prospectSid);
  const restoreTimeoutRef = useRef<number | null>(null);
  const [values, setValues] = useState(initialValues);
  const [hydrated, setHydrated] = useState(false);
  const [draftActive, setDraftActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const pendingDraftClear = consumePendingDraftClear(window.sessionStorage, notice, CLEAR_NOTICES);

    if (pendingDraftClear) {
      clearLocalRecordDraft(window.localStorage, pendingDraftClear.storageKey);
    } else if (notice && CLEAR_NOTICES.includes(notice as (typeof CLEAR_NOTICES)[number])) {
      clearLocalRecordDraft(window.localStorage, storageKey);
    }

    const restoredValues = mergeDraftValues(
      initialValues,
      readLocalRecordDraft<ProspectUpdateValues>(window.localStorage, storageKey)
    );
    const restoredDraftActive = hasLocalDraftChanges(initialValues, restoredValues);

    setValues(restoredValues);
    setDraftActive(restoredDraftActive);
    setHydrated(true);
  }, [initialValues, notice, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hydrated) {
      return;
    }

    if (hasLocalDraftChanges(initialValues, values)) {
      writeLocalRecordDraft(window.localStorage, storageKey, values);
      setDraftActive(true);
      return;
    }

    clearLocalRecordDraft(window.localStorage, storageKey);
    setDraftActive(false);
  }, [hydrated, initialValues, storageKey, values]);

  useEffect(() => {
    return () => {
      if (restoreTimeoutRef.current != null) {
        window.clearTimeout(restoreTimeoutRef.current);
      }
    };
  }, []);

  function updateValue(field: keyof ProspectUpdateValues, nextValue: string) {
    setValues((current) => ({
      ...current,
      [field]: nextValue
    }));
  }

  function handleSubmitCapture() {
    if (typeof window === 'undefined' || !hasLocalDraftChanges(initialValues, values)) {
      return;
    }

    const draftJson = JSON.stringify(values);
    stagePendingDraftClear(window.sessionStorage, storageKey, draftJson);
    clearLocalRecordDraft(window.localStorage, storageKey);
    setDraftActive(false);

    if (restoreTimeoutRef.current != null) {
      window.clearTimeout(restoreTimeoutRef.current);
    }

    restoreTimeoutRef.current = window.setTimeout(() => {
      const pendingDraftClear = restorePendingDraftClear(window.sessionStorage, storageKey);

      if (!pendingDraftClear) {
        return;
      }

      window.localStorage.setItem(storageKey, pendingDraftClear.draftJson);

      const restoredValues = mergeDraftValues(
        initialValues,
        readLocalRecordDraft<ProspectUpdateValues>(window.localStorage, storageKey)
      );

      setValues(restoredValues);
      setDraftActive(hasLocalDraftChanges(initialValues, restoredValues));
    }, 5000);
  }

  return (
    <form action={saveAction} onSubmitCapture={handleSubmitCapture} className="mt-4 space-y-4">
      {draftActive ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">{LOCAL_DRAFT_LABEL}</span>{' '}
          Stored only in this browser until you save changes.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <div className="mb-2 font-medium">Company name</div>
          <input
            name="companyName"
            value={values.companyName}
            onChange={(event) => updateValue('companyName', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">Contact name</div>
          <input
            name="contactName"
            value={values.contactName}
            onChange={(event) => updateValue('contactName', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">Contact phone</div>
          <input
            name="contactPhone"
            value={values.contactPhone}
            onChange={(event) => updateValue('contactPhone', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">Contact email</div>
          <input
            name="contactEmail"
            value={values.contactEmail}
            onChange={(event) => updateValue('contactEmail', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">City</div>
          <input
            name="city"
            value={values.city}
            onChange={(event) => updateValue('city', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">State</div>
          <input
            name="state"
            value={values.state}
            onChange={(event) => updateValue('state', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">Source</div>
          <input
            name="sourceLabel"
            value={values.sourceLabel}
            onChange={(event) => updateValue('sourceLabel', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">Next action</div>
          <input
            type="datetime-local"
            name="nextActionAt"
            value={values.nextActionAt}
            onChange={(event) => updateValue('nextActionAt', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">Status</div>
          <select
            name="status"
            value={values.status}
            onChange={(event) => updateValue('status', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          >
            <option value="NEW">New</option>
            <option value="READY">Ready</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="ATTEMPTED">Attempted</option>
            <option value="RESPONDED">Responded</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="DISQUALIFIED">Disqualified</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-2 font-medium">Priority</div>
          <select
            name="priority"
            value={values.priority}
            onChange={(event) => updateValue('priority', event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          >
            <option value="">No priority</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>

        <label className="text-sm md:col-span-2">
          <div className="mb-2 font-medium">Service interest</div>
          <textarea
            name="serviceInterest"
            value={values.serviceInterest}
            onChange={(event) => updateValue('serviceInterest', event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm md:col-span-2">
          <div className="mb-2 font-medium">Notes</div>
          <textarea
            name="notes"
            value={values.notes}
            onChange={(event) => updateValue('notes', event.target.value)}
            rows={6}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        <button className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white">
          Save changes
        </button>
        <button
          formAction={saveAndReviewNextAction}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
        >
          Save and review next
        </button>
      </div>
    </form>
  );
}
