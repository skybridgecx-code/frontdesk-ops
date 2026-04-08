/**
 * OpenAI Realtime API server event handler.
 *
 * Routes all events received from the OpenAI WebSocket to the appropriate
 * handler. The main event categories are:
 *
 * - **Audio delta** (`response.output_audio.delta`) — base64 audio relayed
 *   directly to Twilio via the media stream WebSocket.
 *
 * - **Caller transcript** (delta / completed / failed) — accumulated in
 *   `state.callerTranscriptBuffer`, then persisted on completion via
 *   `TranscriptManager.appendCallerTranscript()`.
 *
 * - **Assistant transcript** (delta / done) — accumulated in
 *   `state.assistantTranscriptBuffer`, then persisted + extraction triggered
 *   via `TranscriptManager.appendAssistantTranscriptAndExtract()`.
 *
 * - **Errors** — logged and persisted as `openai.server.error` events.
 *
 * - **Low-value events** (session.created, rate_limits.updated, etc.) —
 *   logged but not persisted to avoid database bloat.
 *
 * All database writes are enqueued via the `enqueue` callback to avoid
 * blocking the WebSocket message loop.
 */

import type { SessionState, WsRaw, JsonRecord } from '../types.js';
import type { EventPersistence } from '../services/event-persistence.js';
import type { TranscriptManager } from '../services/transcript-manager.js';
import { rawToText, isRecord, getString } from '../lib/ws-utils.js';

/** Event types that are logged but not persisted to the database. */
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

/**
 * Parses and routes a single OpenAI Realtime API server event.
 *
 * @param raw         - Raw WebSocket message (string or Buffer)
 * @param state       - Mutable session state for this call
 * @param events      - Event persistence service
 * @param transcripts - Transcript accumulation + extraction service
 * @param enqueue     - Callback to schedule async work without blocking the WS loop
 */
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

  if (eventType === 'response.output_audio.delta') {
    handleAudioDelta(message, state, events, enqueue);
    return;
  }

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

  if (eventType === 'conversation.item.input_audio_transcription.delta') {
    handleCallerTranscriptDelta(message, state);
    return;
  }

  if (eventType === 'conversation.item.input_audio_transcription.completed') {
    handleCallerTranscriptCompleted(message, state, transcripts, enqueue);
    return;
  }

  if (eventType === 'conversation.item.input_audio_transcription.failed') {
    handleCallerTranscriptFailed(message, state, events, enqueue);
    return;
  }

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

  if (eventType === 'response.output_audio.done') {
    enqueue(async () => {
      await events.persistEvent('openai.output_audio.done', {
        callSid: state.queryCallSid,
        streamSid: state.currentStreamSid
      });
    });
    return;
  }

  if (eventType === 'response.done') {
    enqueue(async () => {
      await events.persistEvent('openai.response.done', {
        callSid: state.queryCallSid,
        streamSid: state.currentStreamSid
      });
    });
    return;
  }

  if (eventType === 'error') {
    handleError(message, state, events, enqueue);
    return;
  }

  if (!LOW_VALUE_EVENT_TYPES.has(eventType)) {
    enqueue(async () => {
      await events.persistEvent('openai.server.event', {
        callSid: state.queryCallSid,
        eventType
      });
    });
  }
}

/** Relays base64 audio from OpenAI back to the Twilio media stream. */
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

/** Accumulates partial caller transcript deltas into the buffer. */
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

/** Handles a completed caller transcript — persists it and resets the buffer. */
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

/** Handles a failed caller transcription — logs the error and resets the buffer. */
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

/** Persists OpenAI error events with structured error details. */
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
