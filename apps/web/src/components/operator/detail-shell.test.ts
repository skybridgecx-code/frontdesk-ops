import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperatorTimelineSection } from './detail-shell.js';

test('OperatorTimelineSection renders call-style operator history', () => {
  const markup = renderToStaticMarkup(
    createElement(OperatorTimelineSection, {
      title: 'Operator timeline',
      description: 'Operator-visible history for this call, newest first.',
      emptyMessage: 'No operator-visible history recorded for this call yet.',
      items: [
        {
          type: 'frontdesk.route.decision',
          occurredAt: '2026-03-01T09:02:00.000Z',
          title: 'Routing decision recorded',
          description: 'Routed live to the daytime voice agent.',
          actorLabel: 'Main Line',
          statusLabel: 'Live agent'
        }
      ]
    })
  );

  assert.match(markup, /Operator timeline/);
  assert.match(markup, /Routing decision recorded/);
  assert.match(markup, /Main Line/);
  assert.match(markup, /Live agent/);
});

test('OperatorTimelineSection renders prospect-style operator history and empty states safely', () => {
  const populatedMarkup = renderToStaticMarkup(
    createElement(OperatorTimelineSection, {
      title: 'Operator timeline',
      description: 'Operator-visible history for this prospect, newest first.',
      emptyMessage: 'No operator-visible history recorded for this prospect yet.',
      items: [
        {
          type: 'prospect.attempt',
          occurredAt: '2026-03-02T10:00:00.000Z',
          title: 'Outreach attempt logged',
          description: 'Phone · No answer — Left voicemail',
          actorLabel: 'Operator',
          statusLabel: 'Attempted'
        }
      ]
    })
  );

  const emptyMarkup = renderToStaticMarkup(
    createElement(OperatorTimelineSection, {
      title: 'Operator timeline',
      description: 'Operator-visible history for this prospect, newest first.',
      emptyMessage: 'No operator-visible history recorded for this prospect yet.',
      items: []
    })
  );

  assert.match(populatedMarkup, /Outreach attempt logged/);
  assert.match(populatedMarkup, /Operator/);
  assert.match(populatedMarkup, /Attempted/);
  assert.match(emptyMarkup, /No operator-visible history recorded for this prospect yet\./);
});
