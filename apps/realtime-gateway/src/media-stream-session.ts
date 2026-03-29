import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { buildRealtimeSessionConfig, connectOpenAIRealtimeWebSocket } from './openai-realtime.js';
import { loadAgentContext } from './agent-context.js';
import { createCallContextResolver } from './call-context.js';
import { createEventPersister } from './event-persistence.js';
import { createTranscriptState } from './transcript-state.js';
import { createCallFinalizer } from './call-finalization.js';
import {
  getNumberOrString,
  getString,
  isRecord,
  rawSize,
  rawToText,
  type JsonRecord,
  type WsRaw
} from './media-message.js';

export function registerMediaStreamRoute(app: FastifyInstance) {
  app.get('/ws/media-stream', { websocket: true }, (socket, request) => {
    const url = new URL(request.url, 'http://localhost');
    const queryCallSid = url.searchParams.get('callSid');
    const phoneNumberId = url.searchParams.get('phoneNumberId');
    const agentProfileId = url.searchParams.get('agentProfileId');

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

    const callContext = createCallContextResolver({
      queryCallSid,
      log: app.log
    });
    const persistEvent = createEventPersister({
      ensureCallContext: callContext.ensureCallContext,
      nextSequence: callContext.nextSequence
    });
    const transcriptState = createTranscriptState();

    function closeOpenAIRealtimeSocket() {
      if (openAIRealtimeSocket && openAIRealtimeSocket.readyState === 1) {
        openAIRealtimeSocket.close();
      }
    }

    const finalizer = createCallFinalizer({
      queryCallSid,
      getCurrentStreamSid: () => currentStreamSid,
      ensureCallContext: callContext.ensureCallContext,
      persistEvent,
      closeOpenAIRealtimeSocket,
      log: app.log
    });

    function enqueue(task: () => Promise<void>) {
      pending = pending.then(task).catch((error: unknown) => {
        app.log.error({
          msg: 'media stream handler failed',
          callSid: queryCallSid,
          error
        });
      });
    }

    async function sendQueuedAudioIfReady() {
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
    }

    async function sendResponseTrigger(input: {
      callSid: string | null;
      streamSid: string | null;
      source: 'live' | 'queued';
    }) {
      if (!openAIRealtimeSocket || openAIRealtimeSocket.readyState !== 1) {
        return;
      }

      openAIRealtimeSocket.send(
        JSON.stringify({
          type: 'input_audio_buffer.commit'
        })
      );

      await persistEvent('openai.input_audio_buffer.commit.sent', {
        callSid: input.callSid,
        streamSid: input.streamSid,
        source: input.source
      });

      app.log.info({
        msg: 'openai input_audio_buffer.commit sent',
        callSid: input.callSid,
        streamSid: input.streamSid,
        source: input.source
      });

      openAIRealtimeSocket.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions: 'Respond naturally, briefly, and only in English to the caller.'
          }
        })
      );

      await persistEvent('openai.response.create.sent', {
        callSid: input.callSid,
        streamSid: input.streamSid,
        source: input.source
      });

      app.log.info({
        msg: 'openai response.create sent',
        callSid: input.callSid,
        streamSid: input.streamSid,
        source: input.source
      });
    }

    async function sendQueuedResponseTriggerIfReady() {
      if (!pendingResponseTrigger || !openAIRealtimeSocket || openAIRealtimeSocket.readyState !== 1) {
        return;
      }

      await sendResponseTrigger({
        ...pendingResponseTrigger,
        source: 'queued'
      });

      pendingResponseTrigger = null;
    }

    function handleOpenAIRealtimeMessage(message: JsonRecord) {
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

      if (eventType === 'input_audio_buffer.committed') {
        const itemId = getString(message, 'item_id');
        transcriptState.setCurrentInputItemId(itemId);

        enqueue(async () => {
          await persistEvent('openai.input_audio_buffer.committed', {
            callSid: queryCallSid,
            streamSid: currentStreamSid,
            itemId
          });
        });

        app.log.info({
          msg: 'openai input audio buffer committed',
          callSid: queryCallSid,
          streamSid: currentStreamSid,
          itemId
        });

        return;
      }

      if (eventType === 'conversation.item.input_audio_transcription.delta') {
        const itemId = getString(message, 'item_id');
        const delta = getString(message, 'delta') ?? '';
        const currentInputItemId = transcriptState.getCurrentInputItemId();

        if (!currentInputItemId || !itemId || itemId === currentInputItemId) {
          if (delta) {
            const totalChars = transcriptState.appendCallerDelta(delta);

            app.log.info({
              msg: 'caller transcript delta received',
              callSid: queryCallSid,
              itemId,
              addedChars: delta.length,
              totalChars
            });
          }
        }

        return;
      }

      if (eventType === 'conversation.item.input_audio_transcription.completed') {
        const itemId = getString(message, 'item_id');
        const transcript = transcriptState.consumeCallerTranscript(getString(message, 'transcript'));
        const currentInputItemId = transcriptState.getCurrentInputItemId();

        if (!currentInputItemId || !itemId || itemId === currentInputItemId) {
          enqueue(async () => {
            const context = await callContext.ensureCallContext();

            if (context && transcript) {
              await prisma.call.update({
                where: { id: context.callId },
                data: { callerTranscript: transcript }
              });
            }

            await persistEvent('openai.input_audio_transcription.completed', {
              callSid: queryCallSid,
              streamSid: currentStreamSid,
              itemId,
              transcriptLength: transcript.length
            });
          });

          app.log.info({
            msg: 'caller transcript completed',
            callSid: queryCallSid,
            itemId,
            transcriptLength: transcript.length
          });

          transcriptState.resetCallerTranscript();
        }

        return;
      }

      if (eventType === 'conversation.item.input_audio_transcription.failed') {
        const errorObj = isRecord(message.error) ? message.error : null;

        enqueue(async () => {
          await persistEvent('openai.input_audio_transcription.failed', {
            callSid: queryCallSid,
            streamSid: currentStreamSid,
            errorType: errorObj ? getString(errorObj, 'type') : null,
            errorCode: errorObj ? getString(errorObj, 'code') : null,
            errorMessage: errorObj ? getString(errorObj, 'message') : null
          });
        });

        app.log.error({
          msg: 'caller transcript failed',
          callSid: queryCallSid,
          errorType: errorObj ? getString(errorObj, 'type') : null,
          errorCode: errorObj ? getString(errorObj, 'code') : null,
          errorMessage: errorObj ? getString(errorObj, 'message') : null
        });

        transcriptState.resetCallerTranscript();
        return;
      }

      if (eventType === 'response.output_audio_transcript.delta') {
        const delta = getString(message, 'delta') ?? '';

        if (delta) {
          const totalChars = transcriptState.appendAssistantDelta(delta);

          app.log.info({
            msg: 'openai output audio transcript delta received',
            callSid: queryCallSid,
            addedChars: delta.length,
            totalChars
          });
        }

        return;
      }

      if (eventType === 'response.output_audio_transcript.done') {
        const transcript = transcriptState.consumeAssistantTranscript(getString(message, 'transcript'));

        enqueue(async () => {
          const context = await callContext.ensureCallContext();

          if (context && transcript) {
            await prisma.call.update({
              where: { id: context.callId },
              data: { assistantTranscript: transcript }
            });
          }

          await persistEvent('openai.output_audio_transcript.done', {
            callSid: queryCallSid,
            streamSid: currentStreamSid,
            transcriptLength: transcript.length
          });
        });

        app.log.info({
          msg: 'openai output audio transcript done',
          callSid: queryCallSid,
          transcriptLength: transcript.length
        });

        transcriptState.resetAssistantTranscript();
        return;
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

          if (finalizer.isFinalizationRequested()) {
            await finalizer.runCallExtraction('response.done');
          }
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

      const lowValueEventTypes = new Set([
        'session.created',
        'session.updated',
        'conversation.item.added',
        'response.content_part.added',
        'response.content_part.done',
        'conversation.item.done',
        'response.output_item.done',
        'rate_limits.updated'
      ]);

      if (!lowValueEventTypes.has(eventType)) {
        enqueue(async () => {
          await persistEvent('openai.server.event', {
            callSid: queryCallSid,
            eventType
          });
        });
      }
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

          await sendQueuedAudioIfReady();
          await sendQueuedResponseTriggerIfReady();
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

        handleOpenAIRealtimeMessage(message);
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

          if (finalizer.isFinalizationRequested() && !finalizer.isExtractionCompleted()) {
            await finalizer.runCallExtraction('openai.ws.closed');
          }
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

            if (openAIReady && openAIRealtimeSocket && openAIRealtimeSocket.readyState === 1) {
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
          finalizer.markFinalizationRequested();

          await persistEvent('twilio.media.stop', {
            callSid: stopCallSid,
            streamSid: stopStreamSid,
            size
          });

          const context = await callContext.ensureCallContext();
          if (context) {
            await prisma.call.updateMany({
              where: {
                id: context.callId,
                status: {
                  in: ['RINGING', 'IN_PROGRESS']
                }
              },
              data: {
                status: 'COMPLETED',
                endedAt: new Date()
              }
            });
          }

          app.log.info({
            msg: 'media stream stop received',
            callSid: stopCallSid,
            streamSid: stopStreamSid
          });

          if (openAIReady && openAIRealtimeSocket && openAIRealtimeSocket.readyState === 1) {
            await sendResponseTrigger({
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
      finalizer.markMediaSocketClosed();

      if (openAIRealtimeSocket) {
        if (finalizer.isFinalizationRequested() && !finalizer.isExtractionCompleted()) {
          finalizer.scheduleFinalizationTimeout('media_socket_closed', enqueue);
        } else {
          closeOpenAIRealtimeSocket();
        }
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
  });
}
