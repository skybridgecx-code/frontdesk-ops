import { describe, expect, it } from 'vitest';
import { buildRealtimeSessionConfig } from '../openai-realtime.js';

describe('buildRealtimeSessionConfig', () => {
  it('includes concise turn-taking guidance in session instructions', () => {
    const config = buildRealtimeSessionConfig({
      systemPrompt: 'You are an AI front desk assistant.',
      voice: 'shimmer'
    });

    expect(config.type).toBe('session.update');
    expect(config.session.instructions).toContain('You are an AI front desk assistant.');
    expect(config.session.instructions).toContain('Wait until the caller fully finishes speaking');
    expect(config.session.instructions).toContain('Keep every response short: 1-2 sentences');
    expect(config.session.instructions).toContain('Ask at most one follow-up question at a time');
    expect(config.session.instructions).toContain('Avoid long monologues.');
  });

  it('uses less aggressive server_vad turn detection settings', () => {
    const config = buildRealtimeSessionConfig({
      systemPrompt: 'Prompt'
    });

    expect(config.session.audio.input.turn_detection).toEqual({
      type: 'server_vad',
      threshold: 0.7,
      prefix_padding_ms: 400,
      silence_duration_ms: 900
    });
  });

  it('preserves realtime voice audio format defaults', () => {
    const config = buildRealtimeSessionConfig({
      systemPrompt: 'Prompt'
    });

    expect(config.session.audio.input.format).toEqual({ type: 'audio/pcmu' });
    expect(config.session.audio.output.format).toEqual({ type: 'audio/pcmu' });
    expect(config.session.audio.output.voice).toBe('alloy');
  });
});
