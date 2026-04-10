import { describe, expect, it } from 'vitest';
import {
  buildCollectReasonTwiml,
  buildErrorTwiml,
  buildGreetingTwiml,
  buildThankYouTwiml,
  buildVoicemailCompleteTwiml
} from '../twiml-builder.js';

describe('twiml-builder', () => {
  it('buildGreetingTwiml returns valid XML with <Say> and <Gather>', () => {
    const xml = buildGreetingTwiml('Skybridge Plumbing', null);

    expect(xml).toContain('<Say');
    expect(xml).toContain('<Gather');
  });

  it('buildGreetingTwiml uses custom greeting when provided', () => {
    const xml = buildGreetingTwiml('Skybridge Plumbing', 'Welcome to Skybridge Plumbing');

    expect(xml).toContain('Welcome to Skybridge Plumbing');
  });

  it('buildGreetingTwiml uses default greeting when greeting is null', () => {
    const xml = buildGreetingTwiml('Skybridge Plumbing', null);

    expect(xml).toContain('Thanks for calling Skybridge Plumbing. How can we help you today?');
  });

  it('buildCollectReasonTwiml includes caller name in <Say>', () => {
    const xml = buildCollectReasonTwiml('Taylor');

    expect(xml).toContain('Thanks Taylor. How can we help you today?');
  });

  it('buildThankYouTwiml includes <Record> element', () => {
    const xml = buildThankYouTwiml('Taylor', 'Skybridge Plumbing');

    expect(xml).toContain('<Record');
    expect(xml).toContain('/v1/twilio/voice/voicemail-complete');
  });

  it('buildVoicemailCompleteTwiml includes <Hangup>', () => {
    const xml = buildVoicemailCompleteTwiml();

    expect(xml).toContain('<Hangup/>');
  });

  it('buildErrorTwiml includes <Hangup>', () => {
    const xml = buildErrorTwiml();

    expect(xml).toContain('<Hangup/>');
  });

  it('all outputs start with XML declaration and include <Response>', () => {
    const outputs = [
      buildGreetingTwiml('Skybridge Plumbing', null),
      buildCollectReasonTwiml('Taylor'),
      buildThankYouTwiml('Taylor', 'Skybridge Plumbing'),
      buildVoicemailCompleteTwiml(),
      buildErrorTwiml()
    ];

    for (const output of outputs) {
      expect(output.startsWith('<?xml')).toBe(true);
      expect(output).toContain('<Response>');
      expect(output).toContain('</Response>');
    }
  });
});
