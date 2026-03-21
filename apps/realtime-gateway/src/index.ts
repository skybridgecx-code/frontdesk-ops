import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { prisma } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';
import { buildRealtimeSessionConfig, connectOpenAIRealtimeWebSocket } from './openai-realtime.js';

type WsRaw = Buffer | ArrayBuffer | Buffer[];
type JsonRecord = Record<string, unknown>;

const app = Fastify({
  logger: true
});

await app.register(websocket);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rawToText(raw: WsRaw) {
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString('utf8');
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString('utf8');
  }

  return raw.toString('utf8');
}

function rawSize(raw: WsRaw) {
  if (raw instanceof ArrayBuffer) {
    return raw.byteLength;
  }

  if (Array.isArray(raw)) {
    return raw.reduce((sum, chunk) => sum + chunk.length, 0);
  }

  return raw.length;
}

function getString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function getNumberOrString(record: JsonRecord, key: string): number | string | null {
  const value = record[key];
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

async function loadAgentContext(agentProfileId: string | null) {
  if (!agentProfileId) {
    return {
      id: null,
      name: 'Default Agent',
      voiceName: 'alloy',
      systemPrompt:
        'You are a concise, helpful AI front desk for a home service business. Capture caller details, identify urgency, and guide the call efficiently.'
    };
  }

  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentProfileId },
    select: {
      id: true,
      name: true,
      voiceName: true,
      systemPrompt: true,
      business: {
        select: {
          name: true
        }
      }
    }
  });

  if (!agent) {
    return {
      id: null,
      name: 'Default Agent',
      voiceName: 'alloy',
      systemPrompt:
        'You are a concise, helpful AI front desk for a home service business. Capture caller details, identify urgency, and guide the call efficiently.'
    };
  }

  return {
    id: agent.id,
    name: agent.name,
    voiceName: agent.voiceName ?? 'alloy',
    systemPrompt:
      agent.systemPrompt ??
      `You are the AI front desk for ${agent.business.name}. Capture caller details, identify urgency, and help the business respond efficiently.`
  };
}

app.get('/health', async () => {
  return {
    ok: true,
    service: 'realtime-gateway'
  };
});

app.get(
  '/ws/media-stream',
  { websocket: true },
  (socket, request) => {
    const url = new URL(request.url, 'http://localhost');
    const queryCallSid = url.searchParams.get('callSid');
    const phoneNumberId = url.searchParams.get('phoneNumberId');
    const agentProfileId = url.searchParams.get('agentProfileId');

    let callId: string | null = null;
    let sequence = 0;
    let pending: Promise<void> = Promise.resolve();
    let openAIRealtimeSocket: ReturnType<typeof connectOpenAIRealtimeWebSocket> | null = null;
    let openAIReady = false;
    let currentStreamSid: string | null = null;
    let pendingResponseTrigger: { callSid: string | null; streamSid: string | null } | null = null;
    const pendingAudio: Array<{
      payload: string;
      streamSid: string | null;
      chunk: number | string | null;
      track: string | null;
    }> = [];

    function enqueue(task: () => Promise<void>) {
      pending = pending.then(task).catch((error: unknown) => {
        app.log.error({
          msg: 'media stream handler failed',
          callSid: queryCallSid,
          error
        });
      });
    }

    async function ensureCallContext() {
      if (callId) {
        return { callId, sequence };
      }

      if (!queryCallSid) {
        return null;
      }

      const call = await prisma.call.findUnique({
        where: { twilioCallSid: queryCallSid },
        select: { id: true }
      });

      if (!call) {
        app.log.warn({
          msg: 'call not found for media stream',
          callSid: queryCallSid
        });
        return null;
      }

      const count = await prisma.callEvent.count({
        where: { callId: call.id }
      });

      callId = call.id;
      sequence = count;

      return { callId, sequence };
    }

    async function persistEvent(type: string, payloadJson: JsonRecord) {
      const context = await ensureCallContext();
      if (!context) return;

      sequence += 1;

      await prisma.callEvent.create({
        data: {
          callId: context.callId,
          type,
          sequence,
          payloadJson: payloadJson as Prisma.InputJsonValue
        }
      });
    }

    app.log.info({
      msg: 'media stream websocket connected',
      callSid: queryCallSid,
      phoneNumberId,
      agentProfileId
    });

    enqueue(async () => {
      const agent = await loadAgentContext(agentProfileId);
      const sessionConfig = buildRealtimeSessionConfig({
        systemPrompt: agent.systemPrompt,
        voice: agent.voiceName
      });

      app.log.info({
        msg: 'realtime session config prepared',
        callSid: queryCallSid,
        phoneNumberId,
        agentProfileId: agent.id,
        agentName: agent.name,
        voiceName: agent.voiceName,
        sessionConfig
      });

      await persistEvent('openai.session.prepared', {
        callSid: queryCallSid,
        phoneNumberId,
        agentProfileId: agent.id,
        agentName: agent.name,
        voiceName: agent.voiceName
      });

      openAIRealtimeSocket = connectOpenAIRealtimeWebSocket();

      openAIRealtimeSocket.on('open', () => {
        app.log.info({
          msg: 'openai realtime websocket connected',
          callSid: queryCallSid,
          agentProfileId: agent.id,
          agentName: agent.name
        });

        enqueue(async () => {
          await persistEvent('openai.ws.connected', {
            callSid: queryCallSid,
            agentProfileId: agent.id,
            agentName: agent.name
          });

          openAIRealtimeSocket?.send(JSON.stringify(sessionConfig));
          openAIReady = true;

          app.log.info({
            msg: 'openai realtime session.update sent',
            callSid: queryCallSid,
            agentProfileId: agent.id
          });

          await persistEvent('openai.session.sent', {
            callSid: queryCallSid,
            agentProfileId: agent.id
          });

          while (
            pendingAudio.length > 0 &&
            openAIRealtimeSocket &&
            openAIRealtimeSocket.readyState === 1
          ) {
            const item = pendingAudio.shift()!;

            openAIRealtimeSocket.send(
              JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: item.payload
              })
            );

            await persistEvent('openai.audio.append.sent', {
              callSid: queryCallSid,
              streamSid: item.streamSid,
              chunk: item.chunk,
              track: item.track,
              payloadSize: item.payload.length,
              source: 'queued'
            });

            app.log.info({
              msg: 'openai audio append sent',
              callSid: queryCallSid,
              streamSid: item.streamSid,
              chunk: item.chunk,
              payloadSize: item.payload.length,
              source: 'queued'
            });
          }

          if (
            pendingResponseTrigger &&
            openAIRealtimeSocket &&
            openAIRealtimeSocket.readyState === 1
          ) {
            openAIRealtimeSocket.send(
              JSON.stringify({
                type: 'input_audio_buffer.commit'
              })
            );

            await persistEvent('openai.input_audio_buffer.commit.sent', {
              callSid: pendingResponseTrigger.callSid,
              streamSid: pendingResponseTrigger.streamSid,
              source: 'queued'
            });

            app.log.info({
              msg: 'openai input_audio_buffer.commit sent',
              callSid: pendingResponseTrigger.callSid,
              streamSid: pendingResponseTrigger.streamSid,
              source: 'queued'
            });

            openAIRealtimeSocket.send(
              JSON.stringify({
                type: 'response.create',
                response: {
                  instructions: 'Respond naturally and briefly to the caller.'
                }
              })
            );

            await persistEvent('openai.response.create.sent', {
              callSid: pendingResponseTrigger.callSid,
              streamSid: pendingResponseTrigger.streamSid,
              source: 'queued'
            });

            app.log.info({
              msg: 'openai response.create sent',
              callSid: pendingResponseTrigger.callSid,
              streamSid: pendingResponseTrigger.streamSid,
              source: 'queued'
            });

            pendingResponseTrigger = null;
          }
        });
      });

      openAIRealtimeSocket.on('message', (raw) => {
        const text = typeof raw === 'string' ? raw : rawToText(raw as Buffer | ArrayBuffer | Buffer[]);

        let message: unknown;
        try {
          message = JSON.parse(text);
        } catch {
          app.log.warn({
            msg: 'openai realtime message was not json',
            callSid: queryCallSid
          });
          return;
        }

        if (!isRecord(message)) {
          app.log.warn({
            msg: 'openai realtime message was not an object',
            callSid: queryCallSid
          });
          return;
        }

        const eventType = getString(message, 'type') ?? 'unknown';

        app.log.info({
          msg: 'openai realtime server event',
          callSid: queryCallSid,
          eventType
        });

        if (eventType === 'response.output_audio.delta') {
          const delta = getString(message, 'delta');

          if (delta && currentStreamSid) {
            socket.send(
              JSON.stringify({
                event: 'media',
                streamSid: currentStreamSid,
                media: {
                  payload: delta
                }
              })
            );

            app.log.info({
              msg: 'twilio outbound media sent',
              callSid: queryCallSid,
              streamSid: currentStreamSid,
              payloadSize: delta.length
            });

            enqueue(async () => {
              await persistEvent('openai.output_audio.delta', {
                callSid: queryCallSid,
                streamSid: currentStreamSid,
                payloadSize: delta.length
              });

              await persistEvent('twilio.outbound.media.sent', {
                callSid: queryCallSid,
                streamSid: currentStreamSid,
                payloadSize: delta.length
              });
            });

            return;
          }
        }

        if (eventType === 'response.output_audio.done') {
          enqueue(async () => {
            await persistEvent('openai.output_audio.done', {
              callSid: queryCallSid,
              streamSid: currentStreamSid
            });
          });
          return;
        }

        if (eventType === 'response.done') {
          enqueue(async () => {
            await persistEvent('openai.response.done', {
              callSid: queryCallSid,
              streamSid: currentStreamSid
            });
          });
          return;
        }

        if (eventType === 'error') {
          const errorObj = isRecord(message.error) ? message.error : null;
          const errorType = errorObj ? getString(errorObj, 'type') : null;
          const errorCode = errorObj ? getString(errorObj, 'code') : null;
          const errorMessage = errorObj ? getString(errorObj, 'message') : null;
          const eventId = getString(message, 'event_id');

          app.log.error({
            msg: 'openai realtime error event',
            callSid: queryCallSid,
            eventId,
            errorType,
            errorCode,
            errorMessage
          });

          enqueue(async () => {
            await persistEvent('openai.server.error', {
              callSid: queryCallSid,
              streamSid: currentStreamSid,
              eventId,
              errorType,
              errorCode,
              errorMessage
            });
          });
          return;
        }

        enqueue(async () => {
          await persistEvent('openai.server.event', {
            callSid: queryCallSid,
            eventType
          });
        });
      });

      openAIRealtimeSocket.on('error', (error) => {
        const errorMessage = error instanceof Error ? error.message : 'unknown';

        app.log.error({
          msg: 'openai realtime websocket error',
          callSid: queryCallSid,
          errorMessage
        });

        enqueue(async () => {
          await persistEvent('openai.ws.error', {
            callSid: queryCallSid,
            error: errorMessage
          });
        });
      });

      openAIRealtimeSocket.on('close', (code, reason) => {
        app.log.info({
          msg: 'openai realtime websocket closed',
          callSid: queryCallSid,
          code,
          reason: reason.toString()
        });

        enqueue(async () => {
          await persistEvent('openai.ws.closed', {
            callSid: queryCallSid,
            code,
            reason: reason.toString()
          });
        });
      });
    });

    socket.on('message', (raw: WsRaw) => {
      enqueue(async () => {
        const size = rawSize(raw);
        const text = rawToText(raw);

        let message: unknown;
        try {
          message = JSON.parse(text);
        } catch (error) {
          app.log.error({
            msg: 'failed to parse media stream message',
            callSid: queryCallSid,
            error
          });
          return;
        }

        if (!isRecord(message)) {
          app.log.warn({
            msg: 'media stream message was not an object',
            callSid: queryCallSid
          });
          return;
        }

        const event = getString(message, 'event');

        if (event === 'start') {
          const start = isRecord(message.start) ? message.start : null;
          const streamSid = start ? getString(start, 'streamSid') : null;
          const messageCallSid = start ? getString(start, 'callSid') ?? queryCallSid ?? null : queryCallSid ?? null;

          if (messageCallSid && streamSid) {
            currentStreamSid = streamSid;
            await prisma.call.updateMany({
              where: { twilioCallSid: messageCallSid },
              data: { twilioStreamSid: streamSid }
            });
          }

          await persistEvent('twilio.media.start', {
            callSid: messageCallSid,
            streamSid,
            phoneNumberId,
            agentProfileId,
            size
          });

          app.log.info({
            msg: 'media stream start received',
            callSid: messageCallSid,
            streamSid,
            phoneNumberId,
            agentProfileId
          });

          return;
        }

        if (event === 'media') {
          const media = isRecord(message.media) ? message.media : null;
          const payload = media ? getString(media, 'payload') : null;

          await persistEvent('twilio.media.media', {
            callSid: queryCallSid,
            streamSid: getString(message, 'streamSid'),
            track: media ? getString(media, 'track') : null,
            chunk: media ? getNumberOrString(media, 'chunk') : null,
            timestamp: media ? getNumberOrString(media, 'timestamp') : null,
            payloadSize: payload?.length ?? 0,
            size
          });

          app.log.info({
            msg: 'media stream media received',
            callSid: queryCallSid,
            streamSid: getString(message, 'streamSid'),
            chunk: media ? getNumberOrString(media, 'chunk') : null,
            track: media ? getString(media, 'track') : null
          });

          if (payload) {
            const streamSid = getString(message, 'streamSid');
            const chunk = media ? getNumberOrString(media, 'chunk') : null;
            const track = media ? getString(media, 'track') : null;

            if (
              openAIReady &&
              openAIRealtimeSocket &&
              openAIRealtimeSocket.readyState === 1
            ) {
              openAIRealtimeSocket.send(
                JSON.stringify({
                  type: 'input_audio_buffer.append',
                  audio: payload
                })
              );

              await persistEvent('openai.audio.append.sent', {
                callSid: queryCallSid,
                streamSid,
                chunk,
                track,
                payloadSize: payload.length,
                source: 'live'
              });

              app.log.info({
                msg: 'openai audio append sent',
                callSid: queryCallSid,
                streamSid,
                chunk,
                payloadSize: payload.length,
                source: 'live'
              });
            } else {
              pendingAudio.push({
                payload,
                streamSid,
                chunk,
                track
              });

              await persistEvent('openai.audio.append.queued', {
                callSid: queryCallSid,
                streamSid,
                chunk,
                track,
                payloadSize: payload.length
              });

              app.log.info({
                msg: 'openai audio append queued',
                callSid: queryCallSid,
                streamSid,
                chunk,
                payloadSize: payload.length
              });
            }
          }

          return;
        }

        if (event === 'stop') {
          const stop = isRecord(message.stop) ? message.stop : null;
          const stopCallSid = stop ? getString(stop, 'callSid') ?? queryCallSid ?? null : queryCallSid ?? null;
          const stopStreamSid = stop ? getString(stop, 'streamSid') : null;

          await persistEvent('twilio.media.stop', {
            callSid: stopCallSid,
            streamSid: stopStreamSid,
            size
          });

          app.log.info({
            msg: 'media stream stop received',
            callSid: stopCallSid,
            streamSid: stopStreamSid
          });

          if (
            openAIReady &&
            openAIRealtimeSocket &&
            openAIRealtimeSocket.readyState === 1
          ) {
            openAIRealtimeSocket.send(
              JSON.stringify({
                type: 'input_audio_buffer.commit'
              })
            );

            await persistEvent('openai.input_audio_buffer.commit.sent', {
              callSid: stopCallSid,
              streamSid: stopStreamSid,
              source: 'live'
            });

            app.log.info({
              msg: 'openai input_audio_buffer.commit sent',
              callSid: stopCallSid,
              streamSid: stopStreamSid,
              source: 'live'
            });

            openAIRealtimeSocket.send(
              JSON.stringify({
                type: 'response.create',
                response: {
                  instructions: 'Respond naturally and briefly to the caller.'
                }
              })
            );

            await persistEvent('openai.response.create.sent', {
              callSid: stopCallSid,
              streamSid: stopStreamSid,
              source: 'live'
            });

            app.log.info({
              msg: 'openai response.create sent',
              callSid: stopCallSid,
              streamSid: stopStreamSid,
              source: 'live'
            });
          } else {
            pendingResponseTrigger = {
              callSid: stopCallSid,
              streamSid: stopStreamSid
            };

            await persistEvent('openai.response.trigger.queued', {
              callSid: stopCallSid,
              streamSid: stopStreamSid
            });

            app.log.info({
              msg: 'openai response trigger queued',
              callSid: stopCallSid,
              streamSid: stopStreamSid
            });
          }

          return;
        }

        await persistEvent('twilio.media.unknown', {
          callSid: queryCallSid,
          event,
          size
        });

        app.log.warn({
          msg: 'unknown media stream event',
          callSid: queryCallSid,
          event
        });
      });
    });

    socket.on('close', () => {
      if (openAIRealtimeSocket) {
        openAIRealtimeSocket.close();
      }

      app.log.info({
        msg: 'media stream websocket closed',
        callSid: queryCallSid
      });
    });

    socket.on('error', (error: Error) => {
      app.log.error({
        msg: 'media stream websocket error',
        callSid: queryCallSid,
        error
      });
    });
  }
);

const port = Number(process.env.PORT_REALTIME ?? 4001);
const host = '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`Realtime gateway listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
