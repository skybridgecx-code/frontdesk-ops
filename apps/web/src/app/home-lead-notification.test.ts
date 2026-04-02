import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperatorLeadWebhookPayload } from './home-lead-notification';

test('buildOperatorLeadWebhookPayload includes queue and prospect links with lead details', () => {
  const payload = buildOperatorLeadWebhookPayload({
    prospectSid: 'PR_TEST_101',
    appBaseUrl: 'http://127.0.0.1:3001/',
    lead: {
      companyName: 'Sterling Dental Group',
      contactName: 'Alicia Grant',
      contactPhone: '703-555-0200',
      contactEmail: 'alicia@example.com',
      city: 'Reston',
      state: 'VA',
      serviceInterest: 'Inbound lead capture',
      notes: 'Wants a walkthrough next week.',
      sourceLabel: 'public_demo_request',
      status: 'READY',
      priority: 'MEDIUM'
    }
  });

  assert.equal(payload.event, 'public_demo_request.created');
  assert.equal(payload.links.queueUrl, 'http://127.0.0.1:3001/prospects?status=READY');
  assert.equal(
    payload.links.prospectUrl,
    'http://127.0.0.1:3001/prospects/PR_TEST_101?returnTo=%2Fprospects%3Fstatus%3DREADY'
  );
  assert.match(payload.text, /New public demo request: Sterling Dental Group/);
  assert.match(payload.text, /Queue: http:\/\/127\.0\.0\.1:3001\/prospects\?status=READY/);
  assert.match(payload.text, /Prospect: http:\/\/127\.0\.0\.1:3001\/prospects\/PR_TEST_101/);
  assert.match(payload.text, /Contact: Alicia Grant/);
  assert.match(payload.text, /Phone: 703-555-0200/);
  assert.match(payload.text, /Email: alicia@example.com/);
});
