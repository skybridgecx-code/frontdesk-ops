import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOpenAIMessage } from '../openai-events.js';

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    queryCallSid: 'CA123',
    phoneNumberId: 'PN1',
    agentProfileId: 'AP1',
    currentStreamSid: 'MZ123',
    currentInputItemId: null,
    assistantTranscriptBuffer: '',
    callerTranscriptBuffer: '',
    pendingResponseTrigger: null,
    pendingAudio: [],
    openAIReady: true,
    openAISocket: null,
    twilioSocket: {
      send: vi.fn()
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    ...overrides
  } as any;
}

function makeEvents() {
  return {
    ensureCallContext: vi.fn().mockResolvedValue({ callId: 'call-1', sequence: 0 }),
    persistEvent: vi.fn().mockResolvedValue(undefined)
  } as any;
}

function makeTranscripts() {
  return {
    appendCallerTranscript: vi.fn().mockResolvedValue(undefined),
    appendAssistantTranscriptAndExtract: vi.fn().mockResolvedValue(undefined)
  } as any;
}

describe('handleOpenAIMessage', () => {
  let state: ReturnType<typeof makeState>;
  let events: ReturnType<typeof makeEvents>;
  let transcripts: ReturnType<typeof makeTranscripts>;
  let enqueuedTasks: Array<() => Promise<void>>;
  let enqueue: (task: () => Promise<void>) => void;

  beforeEach(() => {
    state = makeState();
    events = makeEvents();
    transcripts = makeTranscripts();
    enqueuedTasks = [];
    enqueue = (task) => { enqueuedTasks.push(task); };
  });

  async function runEnqueued() {
    for (const task of enqueuedTasks) {
      await task();
    }
  }

  it('ignores non-JSON messages', () => {
    handleOpenAIMessage('not json {{{', state, events, transcripts, enqueue);
    expect(state.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'openai realtime message was not json' })
    );
  });

  it('ignores non-object messages', () => {
    handleOpenAIMessage(JSON.stringify('just a string'), state, events, transcripts, enqueue);
    expect(state.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'openai realtime message was not an object' })
    );
  });

  describe('response.output_audio.delta', () => {
    it('relays audio delta to Twilio socket', async () => {
      const msg = JSON.stringify({
        type: 'response.output_audio.delta',
        delta: 'base64audiodata'
      });

      handleOpenAIMessage(msg, state, events, transcripts, enqueue);

      expect(state.twilioSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'media',
          streamSid: 'MZ123',
          media: { payload: 'base64audiodata' }
        })
      );

      await runEnqueued();
      expect(events.persistEvent).toHaveBeenCalledWith(
        'openai.output_audio.delta',
        expect.any(Object)
      );
    });

    it('does not relay when no stream SID', () => {
      state.currentStreamSid = null;
      const msg = JSON.stringify({
        type: 'response.output_audio.delta',
        delta: 'base64audiodata'
      });

      handleOpenAIMessage(msg, state, events, transcripts, enqueue);
      expect(state.twilioSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('input_audio_buffer.committed', () => {
    it('sets currentInputItemId', async () => {
      const msg = JSON.stringify({
        type: 'input_audio_buffer.committed',
        item_id: 'item-42'
      });

      handleOpenAIMessage(msg, state, events, transcripts, enqueue);
      expect(state.currentInputItemId).toBe('item-42');

      await runEnqueued();
      expect(events.persistEvent).toHaveBeenCalledWith(
        'openai.input_audio_buffer.committed',
        expect.objectContaining({ itemId: 'item-42' })
      );
    });
  });

  describe('caller transcript delta', () => {
    it('accumulates caller transcript buffer', () => {
      const msg = JSON.stringify({
        type: 'conversation.item.input_audio_transcription.delta',
        item_id: null,
        delta: 'Hello '
      });

      handleOpenAIMessage(msg, state, events, transcripts, enqueue);
      expect(state.callerTranscriptBuffer).toBe('Hello ');

      const msg2 = JSON.stringify({
        type: 'conversation.item.input_audio_transcription.delta',
        item_id: null,
        delta: 'world'
      });

      handleOpenAIMessage(msg2, state, events, transcripts, enqueue);
      expect(state.callerTranscriptBuffer).toBe('Hello world');
    });
  });

  describe('caller transcript completed', () => {
    it('calls appendCallerTranscript and clears buffer', async () => {
      state.callerTranscriptBuffer = 'accumulated text';

      const msg = JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: null,
        transcript: 'final transcript'
      });

      handleOpenAIMessage(msg, state, events, transcripts, enqueue);
      expect(state.callerTranscriptBuffer).toBe('');

      await runEnqueued();
      expect(transcripts.appendCallerTranscript).toHaveBeenCalledWith(
        'final transcript', null, 'MZ123'
      );
    });
  });

  describe('caller transcript failed', () => {
    it('clears buffer and persists error', async () => {
      state.callerTranscriptBuffer = 'partial';

      const msg = JSON.stringify({
        type: 'conversation.item.input_audio_transcription.failed',
        error: { type: 'server_error', code: '500', message: 'failed' }
      });

      handleOpenAIMessage(msg, state, events, transcripts, enqueue);
      expect(state.callerTranscriptBuffer).toBe('');

      await runEnqueued();
      expect(events.persistEvent).toHaveBeenCalledWith(
        'openai.input_audio_transcription.failed',
        expect.objectContaining({ errorType: 'server_error' })
      );
    });
  });

  describe('assistant transcript', () => {
    it('accumulates delta and calls extract on done', async () => {
      const delta1 = JSON.stringify({
        type: 'response.output_audio_transcript.delta',
        delta: 'How can '
      });
      handleOpenAIMessage(delta1, state, events, transcripts, enqueue);
      expect(state.assistantTranscriptBuffer).toBe('How can ');

      const delta2 = JSON.stringify({
        type: 'response.output_audio_transcript.delta',
        delta: 'I help?'
      });
      handleOpenAIMessage(delta2, state, events, transcripts, enqueue);
      expect(state.assistantTranscriptBuffer).toBe('How can I help?');

      const done = JSON.stringify({
        type: 'response.output_audio_transcript.done',
        transcript: 'How can I help you today?'
      });
      handleOpenAIMessage(done, state, events, transcripts, enqueue);
      expect(state.assistantTranscriptBuffer).toBe('');

      await runEnqueued();
      expect(transcripts.appendAssistantTranscriptAndExtract).toHaveBeenCalledWith(
        'How can I help you today?', 'MZ123'
      );
    });
  });

  describe('error events', () => {
    it('persists error details', async () => {
      const msg = JSON.stringify({
        type: 'error',
        event_id: 'evt-1',
        error: { type: 'rate_limit', code: '429', message: 'Too fast' }
      });

      handleOpenAIMessage(msg, state, events, transcripts, enqueue);

      await runEnqueued();
      expect(events.persistEvent).toHaveBeenCalledWith(
        'openai.server.error',
        expect.objectContaining({
          errorType: 'rate_limit',
          errorCode: '429',
          errorMessage: 'Too fast'
        })
      );
    });
  });

  describe('low-value events', () => {
    it('does not persist session.created', () => {
      const msg = JSON.stringify({ type: 'session.created' });
      handleOpenAIMessage(msg, state, events, transcripts, enqueue);
      expect(enqueuedTasks).toHaveLength(0);
    });

    it('does not persist rate_limits.updated', () => {
      const msg = JSON.stringify({ type: 'rate_limits.updated' });
      handleOpenAIMessage(msg, state, events, transcripts, enqueue);
      expect(enqueuedTasks).toHaveLength(0);
    });
  });

  describe('unknown events', () => {
    it('persists non-low-value unknown events', async () => {
      const msg = JSON.stringify({ type: 'some.new.event' });
      handleOpenAIMessage(msg, state, events, transcripts, enqueue);

      await runEnqueued();
      expect(events.persistEvent).toHaveBeenCalledWith(
        'openai.server.event',
        expect.objectContaining({ eventType: 'some.new.event' })
      );
    });
  });
});
