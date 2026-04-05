import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProspectOutreachPrompt,
  getProspectOutreachPriorityBand,
  normalizeProspectOutreachDraft
} from './prospect-outreach';

test('prospect outreach prompt is grounded in the supplied prospect data', () => {
  const prompt = buildProspectOutreachPrompt({
    companyName: 'Acme Plumbing',
    contactName: 'Jordan Smith',
    contactPhone: '555-0101',
    contactEmail: 'jordan@example.com',
    city: 'Austin',
    state: 'TX',
    sourceLabel: 'houston_starter_list',
    status: 'READY',
    priority: 'HIGH',
    serviceInterest: 'Water heater replacement',
    notes: 'Needs evening follow-up and missed two inbound calls.',
    nextActionAt: '2026-04-05T15:00:00.000Z',
    lastAttemptAt: '2026-04-05T09:15:00.000Z',
    recentAttempts: [
      {
        attemptedAt: '2026-04-05T09:15:00.000Z',
        channel: 'CALL',
        outcome: 'NO_ANSWER',
        note: 'No answer on first try.'
      }
    ]
  });

  assert.match(prompt, /Do not mention AI/i);
  assert.match(prompt, /missed inbound jobs/i);
  assert.match(prompt, /Company: Acme Plumbing/);
  assert.match(prompt, /Service interest: Water heater replacement/);
  assert.match(prompt, /Attempt 1/);
  assert.match(prompt, /No answer on first try\./);
});

test('prospect outreach draft normalization clamps score and trims content', () => {
  const normalized = normalizeProspectOutreachDraft({
    qualificationScore: 27,
    fitSummary: '  Strong fit  ',
    chosenAngle: '  Missed inbound jobs  ',
    firstEmailSubject: '  Re: missed leads  ',
    firstEmailBody: '  Body copy  ',
    shortDmText: '  DM copy  ',
    followUp1: '  Follow-up 1  ',
    followUp2: '  Follow-up 2  ',
    callOpener: '  Call opener  ',
    crmNote: '  CRM note  '
  });

  assert.equal(normalized.qualificationScore, 25);
  assert.equal(normalized.priorityBand, 'urgent');
  assert.equal(normalized.fitSummary, 'Strong fit');
  assert.equal(normalized.chosenAngle, 'Missed inbound jobs');
  assert.equal(normalized.firstEmailSubject, 'Re: missed leads');
  assert.equal(normalized.crmNote, 'CRM note');
});

test('priority band maps from score bands', () => {
  assert.equal(getProspectOutreachPriorityBand(0), 'low');
  assert.equal(getProspectOutreachPriorityBand(12), 'medium');
  assert.equal(getProspectOutreachPriorityBand(18), 'high');
  assert.equal(getProspectOutreachPriorityBand(24), 'urgent');
});
