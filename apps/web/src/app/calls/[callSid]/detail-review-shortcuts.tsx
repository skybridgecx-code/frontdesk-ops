'use client';

import { useEffect } from 'react';

type Props = {
  formId: string;
  notesFieldId: string;
  reviewStatusFieldId: string;
  saveButtonId: string;
  saveNextButtonId: string;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function DetailReviewShortcuts({
  formId,
  notesFieldId,
  reviewStatusFieldId,
  saveButtonId,
  saveNextButtonId
}: Props) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const form = document.getElementById(formId) as HTMLFormElement | null;
      const notesField = document.getElementById(notesFieldId) as HTMLTextAreaElement | null;
      const reviewStatusField = document.getElementById(reviewStatusFieldId) as HTMLSelectElement | null;
      const saveButton = document.getElementById(saveButtonId) as HTMLButtonElement | null;
      const saveNextButton = document.getElementById(saveNextButtonId) as HTMLButtonElement | null;

      if (!form || !reviewStatusField || !saveButton || !saveNextButton) {
        return;
      }

      const metaOrCtrl = event.metaKey || event.ctrlKey;

      if (metaOrCtrl && event.key.toLowerCase() === 's') {
        event.preventDefault();
        form.requestSubmit(saveButton);
        return;
      }

      if (metaOrCtrl && event.key === 'Enter') {
        event.preventDefault();
        form.requestSubmit(saveNextButton);
        return;
      }

      if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        const key = event.key.toLowerCase();

        if (key === 'r' || key === 'n' || key === 'u') {
          event.preventDefault();

          reviewStatusField.value =
            key === 'r' ? 'REVIEWED' : key === 'n' ? 'NEEDS_REVIEW' : 'UNREVIEWED';
          reviewStatusField.dispatchEvent(new Event('input', { bubbles: true }));
          reviewStatusField.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }

      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        notesField?.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formId, notesFieldId, reviewStatusFieldId, saveButtonId, saveNextButtonId]);

  return null;
}
