import { connectOpenAIRealtimeWebSocket, buildRealtimeSessionConfig } from '../openai-realtime.js';
import type { SessionState, JsonRecord } from '../types.js';
import type { EventPersistence } from './event-persistence.js';
import type { AgentContext } from './agent-context.js';
import { handleOpenAIMessage } from '../handlers/openai-events.js';
import type { TranscriptManager } from './transcript-manager.js';

/**
 * Connects to OpenAI Realtime, sends session config,
 * drains any queued audio, and wires up inbound event handling.
 */
export function initOpenAIBridge(
  state: SessionState,
  events: EventPersistence,
  transcripts: TranscriptManager,
  agent: AgentContext,
  enqueue: (task: () => Promise<void>) => void
): void {
  const sessionConfig = buildRealtimeSessionConfig({
    systemPrompt: agent.systemPrompt,
    voice: agent.voiceName
  });

  state.log.info({
    msg: 'realtime session config prepared',
    callSid: state.queryCallSid,
    phoneNumberId: state.phoneNumberId,
    agentProfileId: agent.id,
    agentName: agent.name,
    voiceName: agent.voiceName,
    sessionConfig
  });

  const openAISocket = connectOpenAIRealtimeWebSocket();
  state.openAISocket = openAISocket;

  openAISocket.on('open', () => {
    state.log.info({
      msg: 'openai realtime websocket connected',
      callSid: state.queryCallSid,
      agentProfileId: agent.id,
      agentName: agent.name
    });

    enqueue(async () => {
      await events.persistEvent('openai.ws.connected', {
        callSid: state.queryCallSid,
        agentProfileId: agent.id,
        agentName: agent.name
      });

      openAISocket.send(JSON.stringify(sessionConfig));
      state.openAIReady = true;

      state.log.info({
        msg: 'openai realtime session.update sent',
        callSid: state.queryCallSid,
        agentProfileId: agent.id
      });

      await events.persistEvent('openai.session.sent', {
        callSid: state.queryCallSid,
        agentProfileId: agent.id
      });

      // Drain queued audio
      while (state.pendingAudio.length > 0 && openAISocket.readyState === 1) {
        const item = state.pendingAudio.shift()!;

        openAISocket.send(
          JSON.stringify({ type: 'input_audio_buffer.append', audio: item.payload })
        );

        await events.persistEvent('openai.audio.append.sent', {
          callSid: state.queryCallSid,
          streamSid: item.streamSid,
          chunk: item.chunk,
          track: item.track,
          payloadSize: item.payload.length,
          source: 'queued'
        });

        state.log.info({
          msg: 'openai audio append sent',
          callSid: state.queryCallSid,
          streamSid: item.streamSid,
          chunk: item.chunk,
          payloadSize: item.payload.length,
          source: 'queued'
        });
      }

      // Drain queued response trigger
      if (state.pendingResponseTrigger && openAISocket.readyState === 1) {
        openAISocket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));

        await events.persistEvent('openai.input_audio_buffer.commit.sent', {
          callSid: state.pendingResponseTrigger.callSid,
          streamSid: state.pendingResponseTrigger.streamSid,
          source: 'queued'
        });

        state.log.info({
          msg: 'openai input_audio_buffer.commit sent',
          callSid: state.pendingResponseTrigger.callSid,
          streamSid: state.pendingResponseTrigger.streamSid,
          source: 'queued'
        });

        openAISocket.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              instructions: 'Respond naturally, briefly, and only in English to the caller.'
            }
          })
        );

        await events.persistEvent('openai.response.create.sent', {
          callSid: state.pendingResponseTrigger.callSid,
          streamSid: state.pendingResponseTrigger.streamSid,
          source: 'queued'
        });

        state.log.info({
          msg: 'openai response.create sent',
          callSid: state.pendingResponseTrigger.callSid,
          streamSid: state.pendingResponseTrigger.streamSid,
          source: 'queued'
        });

        state.pendingResponseTrigger = null;
      }
    });
  });

  openAISocket.on('message', (raw) => {
    handleOpenAIMessage(raw, state, events, transcripts, enqueue);
  });

  openAISocket.on('error', (error) => {
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    state.log.error({ msg: 'openai realtime websocket error', callSid: state.queryCallSid, errorMessage });
    enqueue(async () => {
      await events.persistEvent('openai.ws.error', { callSid: state.queryCallSid, error: errorMessage });
    });
  });

  openAISocket.on('close', (code, reason) => {
    state.log.info({
      msg: 'openai realtime websocket closed',
      callSid: state.queryCallSid,
      code,
      reason: reason.toString()
    });
    enqueue(async () => {
      await events.persistEvent('openai.ws.closed', {
        callSid: state.queryCallSid,
        code,
        reason: reason.toString()
      });
    });
  });
}
