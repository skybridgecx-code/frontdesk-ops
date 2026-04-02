export const LOCAL_DRAFT_LABEL = 'Local unsaved draft';

const PENDING_DRAFT_CLEAR_KEY = 'frontdesk:local-draft:pending-clear';

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type PendingDraftClear = {
  storageKey: string;
  draftJson: string;
};

export function buildLocalDraftStorageKey(kind: 'call' | 'prospect', recordId: string) {
  return `frontdesk:${kind}-draft:${recordId}`;
}

export function shouldClearLocalDraftFromNotice(notice: string | undefined, clearNotices: readonly string[]) {
  return notice != null && clearNotices.includes(notice);
}

export function readLocalRecordDraft<T extends Record<string, string>>(
  storage: StorageLike,
  storageKey: string
) {
  const raw = storage.getItem(storageKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Partial<T>;
  } catch {
    return null;
  }
}

export function writeLocalRecordDraft<T extends Record<string, string>>(
  storage: StorageLike,
  storageKey: string,
  values: T
) {
  storage.setItem(storageKey, JSON.stringify(values));
}

export function clearLocalRecordDraft(storage: StorageLike, storageKey: string) {
  storage.removeItem(storageKey);
}

export function stagePendingDraftClear(storage: StorageLike, storageKey: string, draftJson: string) {
  const payload: PendingDraftClear = {
    storageKey,
    draftJson
  };

  storage.setItem(PENDING_DRAFT_CLEAR_KEY, JSON.stringify(payload));
}

export function consumePendingDraftClear(
  storage: StorageLike,
  notice: string | undefined,
  clearNotices: readonly string[]
) {
  if (!shouldClearLocalDraftFromNotice(notice, clearNotices)) {
    return null;
  }

  const raw = storage.getItem(PENDING_DRAFT_CLEAR_KEY);
  storage.removeItem(PENDING_DRAFT_CLEAR_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PendingDraftClear;

    if (!parsed || typeof parsed.storageKey !== 'string') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function restorePendingDraftClear(storage: StorageLike, storageKey: string) {
  const raw = storage.getItem(PENDING_DRAFT_CLEAR_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PendingDraftClear;

    if (!parsed || parsed.storageKey !== storageKey || typeof parsed.draftJson !== 'string') {
      return null;
    }

    storage.removeItem(PENDING_DRAFT_CLEAR_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function hasLocalDraftChanges<T extends Record<string, string>>(initialValues: T, currentValues: T) {
  const keys = Object.keys(initialValues) as Array<keyof T>;

  return keys.some((key) => initialValues[key] !== currentValues[key]);
}

export function mergeDraftValues<T extends Record<string, string>>(initialValues: T, draftValues: Partial<T> | null): T {
  if (!draftValues) {
    return initialValues;
  }

  return {
    ...initialValues,
    ...draftValues
  };
}
