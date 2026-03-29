import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFrontdeskInboundRoutingPolicy } from '@frontdesk/domain';

const weekdayHours = [
  {
    weekday: 'MONDAY' as const,
    openTime: '09:00',
    closeTime: '17:00',
    isClosed: false
  }
];

test('routing policy resolves AI_ALWAYS deterministically', () => {
  const policy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/New_York',
    businessHours: weekdayHours,
    routingMode: 'AI_ALWAYS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-30T15:00:00.000Z')
  });

  assert.equal(policy.isOpen, true);
  assert.equal(policy.routeKind, 'AI');
  assert.equal(policy.agentProfileId, 'agent_primary');
  assert.equal(policy.reason, 'AI_ALWAYS');
  assert.equal(policy.message, 'Connecting to AI front desk');
});

test('routing policy keeps AI_AFTER_HOURS on the primary profile during open hours', () => {
  const policy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/New_York',
    businessHours: weekdayHours,
    routingMode: 'AI_AFTER_HOURS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-30T15:00:00.000Z')
  });

  assert.equal(policy.isOpen, true);
  assert.equal(policy.routeKind, 'AI');
  assert.equal(policy.agentProfileId, 'agent_primary');
  assert.equal(policy.reason, 'AI_AFTER_HOURS_OPEN');
  assert.equal(policy.message, 'Connecting to main AI front desk');
});

test('routing policy sends AI_AFTER_HOURS to the after-hours profile when closed', () => {
  const policy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/New_York',
    businessHours: weekdayHours,
    routingMode: 'AI_AFTER_HOURS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-30T01:00:00.000Z')
  });

  assert.equal(policy.isOpen, false);
  assert.equal(policy.routeKind, 'AI');
  assert.equal(policy.agentProfileId, 'agent_after');
  assert.equal(policy.reason, 'AI_AFTER_HOURS_CLOSED');
  assert.equal(policy.message, 'Connecting to after-hours AI front desk');
});

test('routing policy falls back to the primary profile when after-hours profile is missing', () => {
  const policy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/New_York',
    businessHours: weekdayHours,
    routingMode: 'AI_AFTER_HOURS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: null,
    now: new Date('2026-03-30T01:00:00.000Z')
  });

  assert.equal(policy.isOpen, false);
  assert.equal(policy.routeKind, 'AI');
  assert.equal(policy.agentProfileId, 'agent_primary');
  assert.equal(policy.reason, 'AI_AFTER_HOURS_CLOSED');
});

test('routing policy keeps HUMAN_ONLY on the non-AI message path', () => {
  const policy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/New_York',
    businessHours: weekdayHours,
    routingMode: 'HUMAN_ONLY',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-30T15:00:00.000Z')
  });

  assert.equal(policy.routeKind, 'HUMAN');
  assert.equal(policy.agentProfileId, null);
  assert.equal(policy.reason, 'HUMAN_ONLY');
  assert.match(policy.message, /team is not yet connected/i);
});

test('routing policy keeps AI_OVERFLOW on the current non-AI overflow path', () => {
  const policy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/New_York',
    businessHours: weekdayHours,
    routingMode: 'AI_OVERFLOW',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-30T15:00:00.000Z')
  });

  assert.equal(policy.routeKind, 'HUMAN');
  assert.equal(policy.agentProfileId, 'agent_primary');
  assert.equal(policy.reason, 'AI_OVERFLOW');
  assert.match(policy.message, /Overflow routing is not yet connected/i);
});

test('routing policy treats missing business-hours rows as closed', () => {
  const policy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/New_York',
    businessHours: [],
    routingMode: 'AI_AFTER_HOURS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-30T15:00:00.000Z')
  });

  assert.equal(policy.isOpen, false);
  assert.equal(policy.reason, 'AI_AFTER_HOURS_CLOSED');
  assert.equal(policy.agentProfileId, 'agent_after');
});

test('routing policy treats incomplete hours as closed', () => {
  const policy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/New_York',
    businessHours: [
      {
        weekday: 'MONDAY',
        openTime: '09:00',
        closeTime: null,
        isClosed: false
      }
    ],
    routingMode: 'AI_AFTER_HOURS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-30T15:00:00.000Z')
  });

  assert.equal(policy.isOpen, false);
  assert.equal(policy.reason, 'AI_AFTER_HOURS_CLOSED');
});

test('routing policy evaluates business-open state using the configured timezone deterministically', () => {
  const openPolicy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/Los_Angeles',
    businessHours: weekdayHours,
    routingMode: 'AI_AFTER_HOURS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-30T17:30:00.000Z')
  });
  const closedPolicy = resolveFrontdeskInboundRoutingPolicy({
    timezone: 'America/Los_Angeles',
    businessHours: weekdayHours,
    routingMode: 'AI_AFTER_HOURS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: 'agent_after',
    now: new Date('2026-03-31T01:30:00.000Z')
  });

  assert.equal(openPolicy.isOpen, true);
  assert.equal(openPolicy.reason, 'AI_AFTER_HOURS_OPEN');
  assert.equal(closedPolicy.isOpen, false);
  assert.equal(closedPolicy.reason, 'AI_AFTER_HOURS_CLOSED');
});
