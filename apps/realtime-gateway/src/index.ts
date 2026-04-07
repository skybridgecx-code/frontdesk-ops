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

  // ── Auth ──
  if (!authorizeWebSocket(socket, token, queryCallSid, app.log)) return;

  // ── Session state ──
  const state: SessionState = {
    queryCallSid,
    phoneNumberId,
    agentProfileId,
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

  // ── Sequential task queue ──
  let pending: Promise<void> = Promise.resolve();

  function enqueue(task: () => Promise<void>) {
    pending = pending.then(task).catch((error: unknown) => {
      app.log.error({ msg: 'media stream handler failed', callSid: queryCallSid, error });
    });
  }

  app.log.info({
    msg: 'media stream websocket connected',
    callSid: queryCallSid,
    phoneNumberId,
    agentProfileId
  });

  // ── Boot OpenAI bridge ──
  enqueue(async () => {
    const agent = await loadAgentContext(agentProfileId);

    await events.persistEvent('openai.session.prepared', {
      callSid: queryCallSid,
      phoneNumberId,
      agentProfileId: agent.id,
      agentName: agent.name,
      voiceName: agent.voiceName
    });

    initOpenAIBridge(state, events, transcripts, agent, enqueue);
  });

  // ── Twilio inbound messages ──
  socket.on('message', (raw: WsRaw) => {
    enqueue(async () => {
      const size = rawSize(raw);
      const text = rawToText(raw);

      let message: unknown;
      try {
        message = JSON.parse(text);
      } catch (error) {
        app.log.error({ msg: 'failed to parse media stream message', callSid: queryCallSid, error });
        return;
      }

      if (!isRecord(message)) {
        app.log.warn({ msg: 'media stream message was not an object', callSid: queryCallSid });
        return;
      }

      const event = getString(message, 'event');

      if (event === 'start') {
        await handleStart(message, state, events, size);
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
        callSid: queryCallSid,
        event,
        size
      });

      app.log.warn({ msg: 'unknown media stream event', callSid: queryCallSid, event });
    });
  });

  // ── Cleanup ──
  socket.on('close', () => {
    if (state.openAISocket) state.openAISocket.close();
    app.log.info({ msg: 'media stream websocket closed', callSid: queryCallSid });
  });

  socket.on('error', (error: Error) => {
    app.log.error({ msg: 'media stream websocket error', callSid: queryCallSid, error });
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
