'use client';

import { useEffect, useRef, useState } from 'react';
import { DetailReviewShortcuts } from './detail-review-shortcuts';
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

type CallReviewValues = {
  reviewStatus: string;
  urgency: string;
  leadName: string;
  leadPhone: string;
  leadIntent: string;
  serviceAddress: string;
  summary: string;
  operatorNotes: string;
};

type Props = {
  callSid: string;
  notice?: string;
  initialValues: CallReviewValues;
  triageStatusLabel: string;
  followUpStatusDetail: string;
  reviewFormId: string;
  notesFieldId: string;
  reviewStatusFieldId: string;
  saveButtonId: string;
  saveNextButtonId: string;
  saveAction: (formData: FormData) => void | Promise<void>;
  saveAndReviewNextAction: (formData: FormData) => void | Promise<void>;
};

const CLEAR_NOTICES = ['saved', 'saved-next', 'no-review-calls'] as const;

export function CallReviewForm({
  callSid,
  notice,
  initialValues,
  triageStatusLabel,
  followUpStatusDetail,
  reviewFormId,
  notesFieldId,
  reviewStatusFieldId,
  saveButtonId,
  saveNextButtonId,
  saveAction,
  saveAndReviewNextAction
}: Props) {
  const storageKey = buildLocalDraftStorageKey('call', callSid);
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

    const restoredValues = mergeDraftValues(initialValues, readLocalRecordDraft<CallReviewValues>(window.localStorage, storageKey));
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

  function updateValue(field: keyof CallReviewValues, nextValue: string) {
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
        readLocalRecordDraft<CallReviewValues>(window.localStorage, storageKey)
      );

      setValues(restoredValues);
      setDraftActive(hasLocalDraftChanges(initialValues, restoredValues));
    }, 5000);
  }

  return (
    <>
      <DetailReviewShortcuts
        formId={reviewFormId}
        notesFieldId={notesFieldId}
        reviewStatusFieldId={reviewStatusFieldId}
        saveButtonId={saveButtonId}
        saveNextButtonId={saveNextButtonId}
      />

      <form id={reviewFormId} action={saveAction} onSubmitCapture={handleSubmitCapture} className="mt-4 space-y-4">
        {draftActive ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-medium">{LOCAL_DRAFT_LABEL}</span>{' '}
            Stored only in this browser until you save changes.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-neutral-200 p-4">
              <h3 className="text-sm font-medium text-black">Disposition</h3>
              <p className="mt-1 text-sm text-neutral-600">
                Set the review state first, then use the follow-up actions above if the call needs outreach or archiving.
              </p>
              <div className="mt-4 space-y-4">
                <label className="text-sm block">
                  <div className="mb-2 font-medium">Review status</div>
                  <select
                    id={reviewStatusFieldId}
                    name="reviewStatus"
                    value={values.reviewStatus}
                    onChange={(event) => updateValue('reviewStatus', event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  >
                    <option value="UNREVIEWED">Unreviewed</option>
                    <option value="NEEDS_REVIEW">Needs review</option>
                    <option value="REVIEWED">Reviewed</option>
                  </select>
                </label>

                <label className="text-sm block">
                  <div className="mb-2 font-medium">Urgency</div>
                  <select
                    name="urgency"
                    value={values.urgency}
                    onChange={(event) => updateValue('urgency', event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  >
                    <option value="">Unspecified</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </label>

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-700">
                  <div>
                    <span className="font-medium text-black">Follow-up status:</span> {triageStatusLabel}
                  </div>
                  <div className="mt-1 text-neutral-600">{followUpStatusDetail}</div>
                </div>
              </div>
            </section>

            <div className="lg:sticky lg:top-4">
              <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-medium text-black">Actions</h3>
                <p className="mt-1 text-sm text-neutral-600">
                  Save the review or move straight to the next call needing attention.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    id={saveButtonId}
                    className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white"
                  >
                    Save changes
                  </button>
                  <button
                    id={saveNextButtonId}
                    formAction={saveAndReviewNextAction}
                    className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
                  >
                    Save and review next
                  </button>
                </div>
              </section>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-neutral-200 p-4">
              <h3 className="text-sm font-medium text-black">Lead details</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-2 font-medium">Lead name</div>
                  <input
                    name="leadName"
                    value={values.leadName}
                    onChange={(event) => updateValue('leadName', event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-2 font-medium">Lead phone</div>
                  <input
                    name="leadPhone"
                    value={values.leadPhone}
                    onChange={(event) => updateValue('leadPhone', event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm md:col-span-2">
                  <div className="mb-2 font-medium">Lead intent</div>
                  <input
                    name="leadIntent"
                    value={values.leadIntent}
                    onChange={(event) => updateValue('leadIntent', event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm md:col-span-2">
                  <div className="mb-2 font-medium">Service address</div>
                  <input
                    name="serviceAddress"
                    value={values.serviceAddress}
                    onChange={(event) => updateValue('serviceAddress', event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 p-4">
              <h3 className="text-sm font-medium text-black">Review summary</h3>
              <div className="mt-4 space-y-4">
                <label className="text-sm block">
                  <div className="mb-2 font-medium">Summary</div>
                  <textarea
                    name="summary"
                    value={values.summary}
                    onChange={(event) => updateValue('summary', event.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm block">
                  <div className="mb-2 font-medium">Operator notes</div>
                  <textarea
                    id={notesFieldId}
                    name="operatorNotes"
                    value={values.operatorNotes}
                    onChange={(event) => updateValue('operatorNotes', event.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>
      </form>
    </>
  );
}
