import test from 'node:test';
import assert from 'node:assert/strict';
import { composeFrontdeskSessionContext } from './frontdesk-session-context';

test('composeFrontdeskSessionContext uses full business context when available', () => {
  const context = composeFrontdeskSessionContext({
    businessName: 'Blue Harbor HVAC',
    businessVertical: 'HVAC',
    timezone: 'America/New_York',
    phoneNumberLabel: 'Main line',
    routingMode: 'AI_AFTER_HOURS',
    agentName: 'Dispatch Agent',
    agentSystemPrompt: null,
    businessHours: [
      {
        weekday: 'MONDAY',
        openTime: '08:00',
        closeTime: '17:00',
        isClosed: false
      }
    ],
    serviceAreas: [
      {
        label: 'Reston',
        city: 'Reston',
        state: 'VA',
        postalCode: null
      }
    ],
    now: new Date('2026-03-30T14:00:00.000Z')
  });

  assert.match(context.instructions, /Blue Harbor HVAC/);
  assert.match(context.instructions, /Business vertical: Hvac\./);
  assert.match(context.instructions, /Phone line label: Main line\./);
  assert.match(context.instructions, /Configured routing mode: Ai After Hours\./);
  assert.match(context.instructions, /Known service-area guidance: Reston\./);
  assert.equal(context.metadata.hoursState, 'open');
});

test('composeFrontdeskSessionContext degrades safely when hours and service areas are missing', () => {
  const context = composeFrontdeskSessionContext({
    businessName: 'Plain Service Co',
    businessVertical: null,
    timezone: null,
    phoneNumberLabel: null,
    routingMode: null,
    agentName: null,
    agentSystemPrompt: null,
    businessHours: [],
    serviceAreas: []
  });

  assert.match(context.instructions, /Business hours are not configured/);
  assert.match(context.instructions, /Service areas are not configured/);
  assert.match(context.instructions, /Do not assume services beyond what the caller describes/);
  assert.equal(context.metadata.hoursState, 'unknown');
});

test('composeFrontdeskSessionContext appends agent prompt override as an enrichment layer', () => {
  const context = composeFrontdeskSessionContext({
    businessName: 'North Star Plumbing',
    businessVertical: 'PLUMBING',
    timezone: 'America/New_York',
    phoneNumberLabel: null,
    routingMode: null,
    agentName: 'Plumbing Front Desk',
    agentSystemPrompt: 'Always confirm whether the caller has shut off the water when there is an active leak.',
    businessHours: [],
    serviceAreas: []
  });

  assert.match(context.instructions, /Additional business-specific instruction from the agent profile/);
  assert.match(context.instructions, /shut off the water/);
});

test('composeFrontdeskSessionContext keeps sane fallback behavior when optional data is missing', () => {
  const context = composeFrontdeskSessionContext({
    businessName: null,
    businessVertical: null,
    timezone: 'America/New_York',
    phoneNumberLabel: null,
    routingMode: null,
    agentName: null,
    agentSystemPrompt: null,
    businessHours: [
      {
        weekday: 'SUNDAY',
        openTime: null,
        closeTime: null,
        isClosed: true
      }
    ],
    serviceAreas: [],
    now: new Date('2026-03-29T17:00:00.000Z')
  });

  assert.match(context.instructions, /You are the AI front desk for the business\./);
  assert.match(context.instructions, /The business appears closed right now/);
  assert.equal(context.metadata.businessName, 'the business');
  assert.equal(context.metadata.hoursState, 'closed');
});
