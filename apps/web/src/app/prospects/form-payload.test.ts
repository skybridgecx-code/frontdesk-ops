import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProspectSavePayload } from './form-payload';

test('buildProspectSavePayload trims values and normalizes blanks to null', () => {
  const formData = new FormData();
  formData.set('companyName', '  Sterling Property Group  ');
  formData.set('contactName', '  Marcus Reed ');
  formData.set('contactPhone', '   ');
  formData.set('contactEmail', ' mreed@example.com ');
  formData.set('city', ' Sterling ');
  formData.set('state', ' VA ');
  formData.set('sourceLabel', ' referral ');
  formData.set('serviceInterest', '  After-hours intake ');
  formData.set('notes', '  Good fit ');
  formData.set('status', 'READY');
  formData.set('priority', '');
  formData.set('nextActionAt', '   ');

  assert.deepEqual(buildProspectSavePayload(formData), {
    companyName: 'Sterling Property Group',
    contactName: 'Marcus Reed',
    contactPhone: null,
    contactEmail: 'mreed@example.com',
    city: 'Sterling',
    state: 'VA',
    sourceLabel: 'referral',
    serviceInterest: 'After-hours intake',
    notes: 'Good fit',
    status: 'READY',
    priority: null,
    nextActionAt: null
  });
});

test('buildProspectSavePayload converts nextActionAt to ISO string', () => {
  const formData = new FormData();
  formData.set('companyName', 'Herndon Animal Clinic');
  formData.set('status', 'ATTEMPTED');
  formData.set('priority', 'HIGH');
  formData.set('nextActionAt', '2026-03-27T10:30');

  const payload = buildProspectSavePayload(formData);

  assert.equal(payload.companyName, 'Herndon Animal Clinic');
  assert.equal(payload.status, 'ATTEMPTED');
  assert.equal(payload.priority, 'HIGH');
  assert.equal(payload.nextActionAt, '2026-03-27T14:30:00.000Z');
});
