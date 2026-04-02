import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LOCAL_DRAFT_LABEL,
  buildLocalDraftStorageKey,
  clearLocalRecordDraft,
  consumePendingDraftClear,
  hasLocalDraftChanges,
  mergeDraftValues,
  readLocalRecordDraft,
  restorePendingDraftClear,
  shouldClearLocalDraftFromNotice,
  stagePendingDraftClear,
  writeLocalRecordDraft
} from './local-record-draft';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test('call and prospect drafts restore only for the same record key', () => {
  const storage = new MemoryStorage();
  const callKey = buildLocalDraftStorageKey('call', 'CA_DEMO_101');
  const otherCallKey = buildLocalDraftStorageKey('call', 'CA_DEMO_102');
  const prospectKey = buildLocalDraftStorageKey('prospect', 'PR_DEMO_101');

  writeLocalRecordDraft(storage, callKey, {
    leadName: 'Taylor',
    summary: 'Call back'
  });
  writeLocalRecordDraft(storage, prospectKey, {
    companyName: 'Northwind',
    notes: 'Send follow-up'
  });

  assert.deepEqual(readLocalRecordDraft(storage, callKey), {
    leadName: 'Taylor',
    summary: 'Call back'
  });
  assert.equal(readLocalRecordDraft(storage, otherCallKey), null);
  assert.deepEqual(readLocalRecordDraft(storage, prospectKey), {
    companyName: 'Northwind',
    notes: 'Send follow-up'
  });
});

test('successful save notices consume the pending draft clear marker', () => {
  const session = new MemoryStorage();
  const callKey = buildLocalDraftStorageKey('call', 'CA_DEMO_101');

  stagePendingDraftClear(session, callKey, '{"leadName":"Taylor"}');

  assert.deepEqual(consumePendingDraftClear(session, 'saved', ['saved', 'saved-next', 'no-review-calls']), {
    storageKey: callKey,
    draftJson: '{"leadName":"Taylor"}'
  });
  assert.equal(
    consumePendingDraftClear(session, 'saved', ['saved', 'saved-next', 'no-review-calls']),
    null
  );
});

test('pending draft clear can be restored if submit does not navigate away', () => {
  const session = new MemoryStorage();
  const prospectKey = buildLocalDraftStorageKey('prospect', 'PR_DEMO_101');

  stagePendingDraftClear(session, prospectKey, '{"companyName":"Northwind"}');

  assert.deepEqual(restorePendingDraftClear(session, prospectKey), {
    storageKey: prospectKey,
    draftJson: '{"companyName":"Northwind"}'
  });
});

test('draft helpers track local unsaved state honestly', () => {
  assert.equal(LOCAL_DRAFT_LABEL, 'Local unsaved draft');
  assert.equal(shouldClearLocalDraftFromNotice('saved', ['saved', 'saved-next']), true);
  assert.equal(shouldClearLocalDraftFromNotice('archived', ['saved', 'saved-next']), false);
  assert.equal(
    hasLocalDraftChanges(
      { leadName: '', summary: '' },
      { leadName: 'Taylor', summary: '' }
    ),
    true
  );
  assert.deepEqual(
    mergeDraftValues(
      { leadName: '', summary: '' },
      { summary: 'Needs review' }
    ),
    { leadName: '', summary: 'Needs review' }
  );
});

test('clearing a saved draft removes the stored record entry', () => {
  const storage = new MemoryStorage();
  const callKey = buildLocalDraftStorageKey('call', 'CA_DEMO_101');

  writeLocalRecordDraft(storage, callKey, {
    leadName: 'Taylor',
    summary: 'Needs review'
  });
  clearLocalRecordDraft(storage, callKey);

  assert.equal(readLocalRecordDraft(storage, callKey), null);
});
