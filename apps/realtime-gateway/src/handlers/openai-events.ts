import type { SessionState, WsRaw, JsonRecord } from '../types.js';
import type { EventPersistence } from '../services/event-persistence.js';
import type { TranscriptManager } from '../services/transcript-manager.js';
import { rawToText, isRecord, getString } from '../lib/ws-utils.js';

const LOW_VALUE_EVENT_TYPES = new Set([
  'session.created',
  'session.updated',
  'conversation.item.added',
  'response.content_part.added',
  'response.content_part.done',
  'conversation.item.done',
  'response.output_item.done',
  'rate_limits.updated'
]);

export function handleOpenAIMessage(
  raw: unknown,
  state: SessionState,
  events: EventPersistence,
  transcripts: TranscriptManager,
  enqueue: (task: () => Promise<void>) => void
): void {
  const text = typeof raw === 'string' ? raw : rawToText(raw as WsRaw);

  let message: unknown;
  try {
    message = JSON.parse(text);
  } catch {
    state.log.warn({ msg: 'openai realtime message was not json', callSid: state.queryCallSid });
    return;
  }

  if (!isRecord(message)) {
    state.log.warn({ msg: 'openai realtime message was not an object', callSid: state.queryCallSid });
    return;
  }

  const eventType = getString(message, 'type') ?? 'unknown';

  state.log.info({ msg: 'openai realtime server event', callSid: state.queryCallSid, eventType });

  // --- Audio delta → relay to Twilio ---
  if (eventType === 'response.output_audio.delta') {
    handleAudioDelta(message, state, events, enqueue);
    return;
  }

  // --- Input audio committed ---
  if (eventType === 'input_audio_buffer.committed') {
    const itemId = getString(message, 'item_id');
    state.currentInputItemId = itemId;
    enqueue(async () => {
      await events.persistEvent('openai.input_audio_buffer.committed', {
        callSid: state.queryCallSid,
        streamSid: state.currentStreamSid,
        itemId
      });
    });
    state.log.info({
      msg: 'openai input audio buffer committed',
      callSid: state.queryCallSid,
      streamSid: state.currentStreamSid,
      itemId
    });
    return;
  }

  // --- Caller transcript delta ---
  if (eventType === 'conversation.item.input_audio_transcription.delta') {
    handleCallerTranscriptDelta(message, state);
    return;
  }

  // --- Caller transcript completed ---
  if (eventType === 'conversation.item.input_audio_transcription.completed') {
    handleCallerTranscriptCompleted(message, state, transcripts, enqueue);
    return;
  }

  // --- Caller transcript failed ---
  if (eventType === 'conversation.item.input_audio_transcription.failed') {
    handleCallerTranscriptFailed(message, state, events, enqueue);
    return;
  }

  // --- Assistant transcript delta ---
  if (eventType === 'response.output_audio_transcript.delta') {
    const delta = getString(message, 'delta') ?? '';
    if (delta) {
      state.assistantTranscriptBuffer += delta;
      state.log.info({
        msg: 'openai output audio transcript delta received',
        callSid: state.queryCallSid,
        addedChars: delta.length,
        totalChars: state.assistantTranscriptBuffer.length
      });
    }
    return;
  }

  // --- Assistant transcript done → persist + extract ---
  if (eventType === 'response.output_audio_transcript.done') {
    const transcript = getString(message, 'transcript') ?? state.assistantTranscriptBuffer;
    enqueue(async () => {
      await transcripts.appendAssistantTranscriptAndExtract(transcript, state.currentStreamSid);
    });
    state.log.info({
      msg: 'openai output audio transcript done',
      callSid: state.queryCallSid,
      transcriptLength: transcript.length
    });
    state.assistantTranscriptBuffer = '';
    return;
  }

  // --- Output audio done ---
  if (eventType === 'response.output_audio.done') {
    enqueue(async () => {
      await events.persistEvent('openai.output_audio.done', {
        callSid: state.queryCallSid,
        streamSid: state.currentStreamSid
      });
    });
    return;
  }

  // --- Response done ---
  if (eventType === 'response.done') {
    enqueue(async () => {
      await events.persistEvent('openai.response.done', {
        callSid: state.queryCallSid,
        streamSid: state.currentStreamSid
      });
    });
    return;
  }

  // --- Error ---
  if (eventType === 'error') {
    handleError(message, state, events, enqueue);
    return;
  }

  // --- Persist anything that's not low-value ---
  if (!LOW_VALUE_EVENT_TYPES.has(eventType)) {
    enqueue(async () => {
      await events.persistEvent('openai.server.event', {
        callSid: state.queryCallSid,
        eventType
      });
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function handleAudioDelta(
  message: JsonRecord,
  state: SessionState,
  events: EventPersistence,
  enqueue: (task: () => Promise<void>) => void
): void {
  const delta = getString(message, 'delta');
  if (!delta || !state.currentStreamSid) return;

  state.twilioSocket.send(
    JSON.stringify({
      event: 'media',
      streamSid: state.currentStreamSid,
      media: { payload: delta }
    })
  );

  state.log.info({
    msg: 'twilio outbound media sent',
    callSid: state.queryCallSid,
    streamSid: state.currentStreamSid,
    payloadSize: delta.length
  });

  enqueue(async () => {
    await events.persistEvent('openai.output_audio.delta', {
      callSid: state.queryCallSid,
      streamSid: state.currentStreamSid,
      payloadSize: delta.length
    });
    await events.persistEvent('twilio.outbound.media.sent', {
      callSid: state.queryCallSid,
      streamSid: state.currentStreamSid,
      payloadSize: delta.length
    });
  });
}

function handleCallerTranscriptDelta(message: JsonRecord, state: SessionState): void {
  const itemId = getString(message, 'item_id');
  const delta = getString(message, 'delta') ?? '';

  if (!state.currentInputItemId || !itemId || itemId === state.currentInputItemId) {
    if (delta) {
      state.callerTranscriptBuffer += delta;
      state.log.info({
        msg: 'caller transcript delta received',
        callSid: state.queryCallSid,
        itemId,
        addedChars: delta.length,
        totalChars: state.callerTranscriptBuffer.length
      });
    }
  }
}

function handleCallerTranscriptCompleted(
  message: JsonRecord,
  state: SessionState,
  transcripts: TranscriptManager,
  enqueue: (task: () => Promise<void>) => void
): void {
  const itemId = getString(message, 'item_id');
  const transcript = getString(message, 'transcript') ?? state.callerTranscriptBuffer;

  if (!state.currentInputItemId || !itemId || itemId === state.currentInputItemId) {
    enqueue(async () => {
      await transcripts.appendCallerTranscript(transcript, itemId, state.currentStreamSid);
    });
    state.log.info({
      msg: 'caller transcript completed',
      callSid: state.queryCallSid,
      itemId,
      transcriptLength: transcript.length
    });
    state.callerTranscriptBuffer = '';
  }
}

function handleCallerTranscriptFailed(
  message: JsonRecord,
  state: SessionState,
  events: EventPersistence,
  enqueue: (task: () => Promise<void>) => void
): void {
  const errorObj = isRecord(message.error) ? message.error : null;

  enqueue(async () => {
    await events.persistEvent('openai.input_audio_transcription.failed', {
      callSid: state.queryCallSid,
      streamSid: state.currentStreamSid,
      errorType: errorObj ? getString(errorObj, 'type') : null,
      errorCode: errorObj ? getString(errorObj, 'code') : null,
      errorMessage: errorObj ? getString(errorObj, 'message') : null
    });
  });

  state.log.error({
    msg: 'caller transcript failed',
    callSid: state.queryCallSid,
    errorType: errorObj ? getString(errorObj, 'type') : null,
    errorCode: errorObj ? getString(errorObj, 'code') : null,
    errorMessage: errorObj ? getString(errorObj, 'message') : null
  });

  state.callerTranscriptBuffer = '';
}

function handleError(
  message: JsonRecord,
  state: SessionState,
  events: EventPersistence,
  enqueue: (task: () => Promise<void>) => void
): void {
  const errorObj = isRecord(message.error) ? message.error : null;
  const errorType = errorObj ? getString(errorObj, 'type') : null;
  const errorCode = errorObj ? getString(errorObj, 'code') : null;
  const errorMessage = errorObj ? getString(errorObj, 'message') : null;
  const eventId = getString(message, 'event_id');

  state.log.error({
    msg: 'openai realtime error event',
    callSid: state.queryCallSid,
    eventId,
    errorType,
    errorCode,
    errorMessage
  });

  enqueue(async () => {
    await events.persistEvent('openai.server.error', {
      callSid: state.queryCallSid,
      streamSid: state.currentStreamSid,
      eventId,
      errorType,
      errorCode,
      errorMessage
    });
  });
}
