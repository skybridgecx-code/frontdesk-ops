import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRONTDESK_ROUTE_DECISION_EVENT_TYPE,
  getLatestCallRoutingDecision,
  parseCallRoutingDecisionPayload
} from './call-routing-decision.js';

test('parseCallRoutingDecisionPayload returns a clean routing-decision shape', () => {
  assert.deepEqual(
    parseCallRoutingDecisionPayload({
      routingMode: 'AI_AFTER_HOURS',
      isOpen: false,
      routeKind: 'AI',
      agentProfileId: 'agent_after_hours',
      reason: 'AI_AFTER_HOURS_CLOSED',
      message: 'Connecting to after-hours AI front desk',
      phoneLineLabel: 'Main line',
      businessTimezone: 'America/New_York'
    }),
    {
      routingMode: 'AI_AFTER_HOURS',
      isOpen: false,
      routeKind: 'AI',
      agentProfileId: 'agent_after_hours',
      reason: 'AI_AFTER_HOURS_CLOSED',
      message: 'Connecting to after-hours AI front desk',
      phoneLineLabel: 'Main line',
      businessTimezone: 'America/New_York'
    }
  );
});

test('getLatestCallRoutingDecision returns the newest routing decision event only', () => {
  assert.deepEqual(
    getLatestCallRoutingDecision([
      {
        type: FRONTDESK_ROUTE_DECISION_EVENT_TYPE,
        payloadJson: {
          routingMode: 'AI_ALWAYS',
          isOpen: true,
          routeKind: 'AI',
          agentProfileId: 'agent_primary',
          reason: 'AI_ALWAYS',
          message: 'Connecting to AI front desk',
          phoneLineLabel: 'Main line',
          businessTimezone: 'America/New_York'
        }
      },
      {
        type: 'twilio.status.completed',
        payloadJson: {}
      },
      {
        type: FRONTDESK_ROUTE_DECISION_EVENT_TYPE,
        payloadJson: {
          routingMode: 'HUMAN_ONLY',
          isOpen: false,
          routeKind: 'HUMAN',
          agentProfileId: null,
          reason: 'HUMAN_ONLY',
          message: 'Thanks for calling. Our team is not yet connected in this environment. Please call back shortly.',
          phoneLineLabel: 'After-hours line',
          businessTimezone: 'America/New_York'
        }
      }
    ]),
    {
      routingMode: 'HUMAN_ONLY',
      isOpen: false,
      routeKind: 'HUMAN',
      agentProfileId: null,
      reason: 'HUMAN_ONLY',
      message: 'Thanks for calling. Our team is not yet connected in this environment. Please call back shortly.',
      phoneLineLabel: 'After-hours line',
      businessTimezone: 'America/New_York'
    }
  );
});

test('getLatestCallRoutingDecision returns null when no routing decision event exists', () => {
  assert.equal(
    getLatestCallRoutingDecision([
      {
        type: 'twilio.inbound.received',
        payloadJson: { CallSid: 'CA_DEMO_101' }
      }
    ]),
    null
  );
});
