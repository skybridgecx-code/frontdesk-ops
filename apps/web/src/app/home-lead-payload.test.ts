import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicLeadPayload } from './home-lead-payload';

test('buildPublicLeadPayload trims and normalizes a valid lead request', () => {
  const formData = new FormData();
  formData.set('companyName', '  Sterling Dental Group ');
  formData.set('contactName', ' Alicia Grant ');
  formData.set('contactPhone', ' 703-555-0200 ');
  formData.set('contactEmail', ' ');
  formData.set('city', ' Reston ');
  formData.set('state', ' VA ');
  formData.set('serviceInterest', ' Inbound lead capture ');
  formData.set('notes', ' Need a walkthrough next week. ');

  assert.deepEqual(buildPublicLeadPayload(formData), {
    companyName: 'Sterling Dental Group',
    contactName: 'Alicia Grant',
    contactPhone: '703-555-0200',
    contactEmail: null,
    city: 'Reston',
    state: 'VA',
    serviceInterest: 'Inbound lead capture',
    notes: 'Need a walkthrough next week.',
    sourceLabel: 'public_demo_request',
    status: 'READY',
    priority: 'MEDIUM'
  });
});

test('buildPublicLeadPayload requires a company name and some contact method', () => {
  const missingCompany = new FormData();
  missingCompany.set('contactEmail', 'owner@example.com');
  assert.throws(() => buildPublicLeadPayload(missingCompany), /Company name is required/);

  const missingContact = new FormData();
  missingContact.set('companyName', 'SkybridgeCX Prospect');
  assert.throws(() => buildPublicLeadPayload(missingContact), /Add at least one contact method/);
});
