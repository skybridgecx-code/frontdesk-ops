import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@frontdesk/db', () => ({
  prisma: {
    call: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  }
}));

import { prisma } from '@frontdesk/db';
import { handleStart, handleMedia, handleStop } from '../twilio-media.js';

const mockPrisma = prisma as any;

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    queryCallSid: 'CA123',
    phoneNumberId: 'PN1',
    agentProfileId: 'AP1',
    currentStreamSid: null,
    currentInputItemId: null,
    assistantTranscriptBuffer: '',
    callerTranscriptBuffer: '',
    pendingResponseTrigger: null,
    pendingAudio: [] as any[],
    openAIReady: false,
    openAISocket: null,
    twilioSocket: { send: vi.fn() },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    ...overrides
  } as any;
}

function makeEvents() {
  return {
    ensureCallContext: vi.fn().mockResolvedValue({ callId: 'call-1', sequence: 0 }),
    persistEvent: vi.fn().mockResolvedValue(undefined)
  } as any;
}

describe('handleStart', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets currentStreamSid and updates call record', async () => {
    const state = makeState();
    const events = makeEvents();

    await handleStart(
      { event: 'start', start: { streamSid: 'MZ456', callSid: 'CA123' } },
      state,
      events,
      100
    );

    expect(state.currentStreamSid).toBe('MZ456');
    expect(mockPrisma.call.updateMany).toHaveBeenCalledWith({
      where: { twilioCallSid: 'CA123' },
      data: { twilioStreamSid: 'MZ456' }
    });
    expect(events.persistEvent).toHaveBeenCalledWith(
      'twilio.media.start',
      expect.objectContaining({ streamSid: 'MZ456' })
    );
  });

  it('falls back to queryCallSid when start.callSid is missing', async () => {
    const state = makeState({ queryCallSid: 'CA-QUERY' });
    const events = makeEvents();

    await handleStart(
      { event: 'start', start: { streamSid: 'MZ789' } },
      state,
      events,
      50
    );

    expect(mockPrisma.call.updateMany).toHaveBeenCalledWith({
      where: { twilioCallSid: 'CA-QUERY' },
      data: { twilioStreamSid: 'MZ789' }
    });
  });

  it('does not update DB when streamSid is missing', async () => {
    const state = makeState();
    const events = makeEvents();

    await handleStart(
      { event: 'start', start: {} },
      state,
      events,
      50
    );

    expect(state.currentStreamSid).toBeNull();
    expect(mockPrisma.call.updateMany).not.toHaveBeenCalled();
  });
});

describe('handleMedia', () => {
  it('sends audio to OpenAI when ready', () => {
    const openAISocket = { readyState: 1, send: vi.fn() };
    const state = makeState({ openAIReady: true, openAISocket });

    handleMedia(
      {
        event: 'media',
        streamSid: 'MZ123',
        media: { payload: 'audiodata', chunk: 1, track: 'inbound' }
      },
      state
    );

    expect(openAISocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'input_audio_buffer.append', audio: 'audiodata' })
    );
    expect(state.pendingAudio).toHaveLength(0);
  });

  it('queues audio when OpenAI is not ready', () => {
    const state = makeState({ openAIReady: false });

    handleMedia(
      {
        event: 'media',
        streamSid: 'MZ123',
        media: { payload: 'audiodata', chunk: 1, track: 'inbound' }
      },
      state
    );

    expect(state.pendingAudio).toHaveLength(1);
    expect(state.pendingAudio[0]).toEqual({
      payload: 'audiodata',
      streamSid: 'MZ123',
      chunk: 1,
      track: 'inbound'
    });
  });

  it('queues audio when OpenAI socket is not in OPEN state', () => {
    const openAISocket = { readyState: 0, send: vi.fn() };
    const state = makeState({ openAIReady: true, openAISocket });

    handleMedia(
      {
        event: 'media',
        streamSid: 'MZ123',
        media: { payload: 'audiodata', chunk: 1, track: 'inbound' }
      },
      state
    );

    expect(openAISocket.send).not.toHaveBeenCalled();
    expect(state.pendingAudio).toHaveLength(1);
  });

  it('does nothing when payload is missing', () => {
    const openAISocket = { readyState: 1, send: vi.fn() };
    const state = makeState({ openAIReady: true, openAISocket });

    handleMedia(
      { event: 'media', streamSid: 'MZ123', media: {} },
      state
    );

    expect(openAISocket.send).not.toHaveBeenCalled();
    expect(state.pendingAudio).toHaveLength(0);
  });

  it('does nothing when media object is missing', () => {
    const openAISocket = { readyState: 1, send: vi.fn() };
    const state = makeState({ openAIReady: true, openAISocket });

    handleMedia(
      { event: 'media', streamSid: 'MZ123' },
      state
    );

    expect(openAISocket.send).not.toHaveBeenCalled();
  });
});

describe('handleStop', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('marks call as COMPLETED and commits audio when OpenAI is ready', async () => {
    const openAISocket = { readyState: 1, send: vi.fn() };
    const state = makeState({ openAIReady: true, openAISocket });
    const events = makeEvents();

    await handleStop(
      { event: 'stop', stop: { callSid: 'CA123', streamSid: 'MZ123' } },
      state,
      events,
      50
    );

    expect(mockPrisma.call.updateMany).toHaveBeenCalledWith({
      where: { id: 'call-1', status: { in: ['RINGING', 'IN_PROGRESS'] } },
      data: { status: 'COMPLETED', endedAt: expect.any(Date) }
    });

    expect(openAISocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'input_audio_buffer.commit' })
    );
    expect(openAISocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'response.create',
        response: { instructions: 'Respond naturally, briefly, and only in English to the caller.' }
      })
    );

    expect(events.persistEvent).toHaveBeenCalledWith('twilio.media.stop', expect.any(Object));
    expect(events.persistEvent).toHaveBeenCalledWith(
      'openai.input_audio_buffer.commit.sent',
      expect.objectContaining({ source: 'live' })
    );
    expect(events.persistEvent).toHaveBeenCalledWith(
      'openai.response.create.sent',
      expect.objectContaining({ source: 'live' })
    );
  });

  it('queues response trigger when OpenAI is not ready', async () => {
    const state = makeState({ openAIReady: false });
    const events = makeEvents();

    await handleStop(
      { event: 'stop', stop: { callSid: 'CA123', streamSid: 'MZ123' } },
      state,
      events,
      50
    );

    expect(state.pendingResponseTrigger).toEqual({
      callSid: 'CA123',
      streamSid: 'MZ123'
    });

    expect(events.persistEvent).toHaveBeenCalledWith(
      'openai.response.trigger.queued',
      expect.objectContaining({ callSid: 'CA123' })
    );
  });

  it('falls back to queryCallSid when stop.callSid is missing', async () => {
    const state = makeState({ queryCallSid: 'CA-FALLBACK', openAIReady: false });
    const events = makeEvents();

    await handleStop(
      { event: 'stop', stop: { streamSid: 'MZ999' } },
      state,
      events,
      50
    );

    expect(state.pendingResponseTrigger).toEqual({
      callSid: 'CA-FALLBACK',
      streamSid: 'MZ999'
    });
  });

  it('persists stop event even when call context is null', async () => {
    const events = makeEvents();
    events.ensureCallContext.mockResolvedValue(null);
    const state = makeState({ openAIReady: false });

    await handleStop(
      { event: 'stop', stop: { callSid: 'CA123', streamSid: 'MZ123' } },
      state,
      events,
      50
    );

    expect(events.persistEvent).toHaveBeenCalledWith('twilio.media.stop', expect.any(Object));
    expect(mockPrisma.call.updateMany).not.toHaveBeenCalled();
  });
});
