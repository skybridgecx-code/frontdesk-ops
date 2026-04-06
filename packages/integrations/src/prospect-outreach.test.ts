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
  assert.match(prompt, /missed calls/i);
  assert.match(prompt, /Company: Acme Plumbing/);
  assert.match(prompt, /Service interest: Water heater replacement/);
  assert.match(prompt, /Attempt 1/);
  assert.match(prompt, /No answer on first try\./);
  assert.match(prompt, /Operator goal: book a short call\./i);
  assert.match(prompt, /Output length: short: first email body around 90-115 words, follow-ups 1-2 short sentences, no long analysis\./i);
  assert.match(prompt, /Tone: direct\./i);
  assert.match(prompt, /Choose one primary angle only\./i);
  assert.match(prompt, /chosen angle should be a single concise sentence/i);
  assert.match(prompt, /first email subject to 3-6 words/i);
  assert.match(prompt, /DM\/text to about 35-60 words/i);
  assert.match(prompt, /avoid audit, review, diagnostic, memo, consultant-report, workflow optimization, operationalize, leverage, and close the gap framing by default/i);
  assert.match(prompt, /Avoid compressed slash phrases like intake\/routing friction/i);
  assert.match(prompt, /Subject lines should sound human and specific, not templated\./i);
  assert.match(prompt, /Do not force audit-style framing into the first touch\./i);
});

test('prospect outreach prompt tightens by goal, length, and tone', () => {
  const prompt = buildProspectOutreachPrompt(
    {
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
      recentAttempts: []
    },
    {
      goal: 'find_right_contact',
      length: 'medium',
      tone: 'warm'
    }
  );

  assert.match(prompt, /Operator goal: find the right person quickly and keep the handoff simple\./i);
  assert.match(prompt, /Output length: medium: first email body around 110-140 words, follow-ups still brief, no long analysis\./i);
  assert.match(prompt, /Tone: warm\./i);
  assert.match(prompt, /Make the ask simple: identify the right person to speak with\./i);
  assert.match(prompt, /Do not force audit-style framing into the first touch\./i);
});

test('walkthrough goal stays light and does not default to audit framing', () => {
  const prompt = buildProspectOutreachPrompt(
    {
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
      recentAttempts: []
    },
    {
      goal: 'send_walkthrough',
      length: 'short',
      tone: 'direct'
    }
  );

  assert.match(prompt, /Operator goal: send a short walkthrough and see if they want to review it\./i);
  assert.match(prompt, /Make the ask simple: a short walkthrough that is easy to skim\./i);
  assert.match(prompt, /If you mention a walkthrough, keep it practical and brief\. Do not turn it into an audit or analysis\./i);
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
