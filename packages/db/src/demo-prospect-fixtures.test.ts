import test from 'node:test';
import assert from 'node:assert/strict';
import { ProspectPriority, ProspectStatus } from './index';
import { demoProspectFixtures } from './demo-prospect-fixtures';

test('bounded demo prospect fixtures include PR_DEMO_101 through PR_DEMO_106', () => {
  assert.deepEqual(
    demoProspectFixtures.map((fixture) => fixture.prospectSid),
    ['PR_DEMO_101', 'PR_DEMO_102', 'PR_DEMO_103', 'PR_DEMO_104', 'PR_DEMO_105', 'PR_DEMO_106']
  );
});

test('bounded demo prospect fixtures preserve outbound scenario mix', () => {
  const bySid = new Map(demoProspectFixtures.map((fixture) => [fixture.prospectSid, fixture]));

  assert.equal(bySid.get('PR_DEMO_101')?.status, ProspectStatus.READY);
  assert.equal(bySid.get('PR_DEMO_101')?.priority, ProspectPriority.HIGH);

  assert.equal(bySid.get('PR_DEMO_102')?.status, ProspectStatus.READY);
  assert.equal(bySid.get('PR_DEMO_102')?.priority, ProspectPriority.MEDIUM);

  assert.equal(bySid.get('PR_DEMO_103')?.status, ProspectStatus.ATTEMPTED);
  assert.equal(bySid.get('PR_DEMO_103')?.attempts.length, 1);

  assert.equal(bySid.get('PR_DEMO_104')?.status, ProspectStatus.RESPONDED);
  assert.equal(bySid.get('PR_DEMO_104')?.attempts.length, 2);

  assert.equal(bySid.get('PR_DEMO_105')?.status, ProspectStatus.NEW);
  assert.equal(bySid.get('PR_DEMO_105')?.contactPhone, null);

  assert.equal(bySid.get('PR_DEMO_106')?.status, ProspectStatus.ARCHIVED);
  assert.notEqual(bySid.get('PR_DEMO_106')?.archivedAt, null);
});
