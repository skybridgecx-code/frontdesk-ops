import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { prisma } from '@frontdesk/db';
import type { SessionState, WsRaw, JsonRecord } from './types.js';
import { rawToText, rawSize, isRecord, getString } from './lib/ws-utils.js';
import { authorizeWebSocket } from './middleware/ws-auth.js';
import { loadAgentContext } from './services/agent-context.js';
import { EventPersistence } from './services/event-persistence.js';
import { TranscriptManager } from './services/transcript-manager.js';
import { initOpenAIBridge } from './services/openai-bridge.js';
import { handleStart, handleMedia, handleStop } from './handlers/twilio-media.js';

const app = Fastify({ logger: true });

await app.register(websocket);

app.get('/health', async () => ({ ok: true, service: 'realtime-gateway' }));

app.get('/ws/media-stream', { websocket: true }, (socket, request) => {
  const url = new URL(request.url, 'http://localhost');
  const queryCallSid = url.searchParams.get('callSid');
  const phoneNumberId = url.searchParams.get('phoneNumberId');
  const agentProfileId = url.searchParams.get('agentProfileId');
  const token = url.searchParams.get('token');

  // Query-param auth remains supported for local/manual fallback.
  const hasQueryAuthInput = Boolean(queryCallSid || phoneNumberId || agentProfileId || token);
  const queryAuthVerified = hasQueryAuthInput
    ? authorizeWebSocket(socket, token, queryCallSid, app.log)
    : false;

  if (hasQueryAuthInput && !queryAuthVerified) return;

  // ── Session state ──
  const state: SessionState = {
    queryCallSid,
    phoneNumberId,
    tenantId: null,
    businessId: null,
    agentProfileId,
    queryAuthVerified,
    currentStreamSid: null,
    currentInputItemId: null,
    assistantTranscriptBuffer: '',
    callerTranscriptBuffer: '',
    pendingResponseTrigger: null,
    pendingAudio: [],
    openAIReady: false,
    openAISocket: null,
    twilioSocket: socket,
    log: app.log
  };

  // ── Services ──
  const events = new EventPersistence(queryCallSid, app.log);
  const transcripts = new TranscriptManager(app.log, events, queryCallSid);
  let awaitingAuthenticatedStart = !queryAuthVerified;
  let openAIBridgeStarted = false;
  let startAuthTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Sequential task queue ──
  let pending: Promise<void> = Promise.resolve();

  function enqueue(task: () => Promise<void>) {
    pending = pending.then(task).catch((error: unknown) => {
      app.log.error({ msg: 'media stream handler failed', callSid: state.queryCallSid, error });
    });
  }

  function clearStartAuthTimeout() {
    if (startAuthTimeout) {
      clearTimeout(startAuthTimeout);
      startAuthTimeout = null;
    }
  }

  function bootOpenAIBridgeIfReady() {
    if (openAIBridgeStarted) return;
    if (awaitingAuthenticatedStart) return;
    if (!state.queryCallSid) return;

    openAIBridgeStarted = true;

    enqueue(async () => {
      const agent = await loadAgentContext(state.agentProfileId);

      await events.persistEvent('openai.session.prepared', {
        callSid: state.queryCallSid,
        phoneNumberId: state.phoneNumberId,
        agentProfileId: agent.id,
        agentName: agent.name,
        voiceName: agent.voiceName
      });

      initOpenAIBridge(state, events, transcripts, agent, enqueue);
    });
  }

  app.log.info({
    msg: 'media stream websocket connected',
    callSid: state.queryCallSid,
    phoneNumberId: state.phoneNumberId,
    agentProfileId: state.agentProfileId,
    queryAuthVerified
  });

  if (awaitingAuthenticatedStart) {
    startAuthTimeout = setTimeout(() => {
      app.log.warn({
        msg: 'media stream auth timeout waiting for authenticated start event',
        callSid: state.queryCallSid
      });
      socket.close(4401, 'Unauthorized');
    }, 5000);
  }

  bootOpenAIBridgeIfReady();

  // ── Twilio inbound messages ──
  socket.on('message', (raw: WsRaw) => {
    enqueue(async () => {
      const size = rawSize(raw);
      const text = rawToText(raw);

      let message: unknown;
      try {
        message = JSON.parse(text);
      } catch (error) {
        app.log.error({ msg: 'failed to parse media stream message', callSid: state.queryCallSid, error });
        return;
      }

      if (!isRecord(message)) {
        app.log.warn({ msg: 'media stream message was not an object', callSid: state.queryCallSid });
        return;
      }

      const event = getString(message, 'event');

      if (event === 'start') {
        const startResult = await handleStart(message, state, events, size, {
          queryAuthVerified: state.queryAuthVerified
        });

        if (!startResult.accepted) return;

        if (startResult.authenticated) {
          awaitingAuthenticatedStart = false;
          state.queryAuthVerified = true;
          events.setCallSid(state.queryCallSid);
          transcripts.setCallSid(state.queryCallSid);
          clearStartAuthTimeout();
          bootOpenAIBridgeIfReady();
        }

        return;
      }

      if (awaitingAuthenticatedStart) {
        await events.persistEvent('twilio.media.rejected', {
          callSid: state.queryCallSid,
          event,
          reason: 'awaiting_authenticated_start',
          size
        });

        app.log.warn({
          msg: 'media stream message rejected before authenticated start',
          callSid: state.queryCallSid,
          event
        });
        return;
      }

      if (event === 'media') {
        handleMedia(message, state);
        return;
      }

      if (event === 'stop') {
        await handleStop(message, state, events, size);
        return;
      }

      await events.persistEvent('twilio.media.unknown', {
        callSid: state.queryCallSid,
        event,
        size
      });

      app.log.warn({ msg: 'unknown media stream event', callSid: state.queryCallSid, event });
    });
  });

  // ── Cleanup ──
  socket.on('close', () => {
    clearStartAuthTimeout();
    if (state.openAISocket) state.openAISocket.close();
    app.log.info({ msg: 'media stream websocket closed', callSid: state.queryCallSid });
  });

  socket.on('error', (error: Error) => {
    app.log.error({ msg: 'media stream websocket error', callSid: state.queryCallSid, error });
  });
});

// ── Start ──
const port = Number(process.env.PORT_REALTIME ?? 4001);
const host = '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`Realtime gateway listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    app.log.info({ msg: `Received ${signal}, shutting down realtime gateway` });
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
