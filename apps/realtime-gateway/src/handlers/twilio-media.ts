import { prisma } from '@frontdesk/db';
import type { SessionState, JsonRecord } from '../types.js';
import type { EventPersistence } from '../services/event-persistence.js';
import { isRecord, getString, getNumberOrString } from '../lib/ws-utils.js';

export async function handleStart(
  message: JsonRecord,
  state: SessionState,
  events: EventPersistence,
  size: number
): Promise<void> {
  const start = isRecord(message.start) ? message.start : null;
  const streamSid = start ? getString(start, 'streamSid') : null;
  const messageCallSid =
    (start ? getString(start, 'callSid') : null) ?? state.queryCallSid ?? null;

  if (messageCallSid && streamSid) {
    state.currentStreamSid = streamSid;
    await prisma.call.updateMany({
      where: { twilioCallSid: messageCallSid },
      data: { twilioStreamSid: streamSid }
    });
  }

  await events.persistEvent('twilio.media.start', {
    callSid: messageCallSid,
    streamSid,
    phoneNumberId: state.phoneNumberId,
    agentProfileId: state.agentProfileId,
    size
  });

  state.log.info({
    msg: 'media stream start received',
    callSid: messageCallSid,
    streamSid,
    phoneNumberId: state.phoneNumberId,
    agentProfileId: state.agentProfileId
  });
}

export function handleMedia(
  message: JsonRecord,
  state: SessionState
): void {
  const media = isRecord(message.media) ? message.media : null;
  const payload = media ? getString(media, 'payload') : null;

  state.log.info({
    msg: 'media stream media received',
    callSid: state.queryCallSid,
    streamSid: getString(message, 'streamSid'),
    chunk: media ? getNumberOrString(media, 'chunk') : null,
    track: media ? getString(media, 'track') : null
  });

  if (!payload) return;

  const streamSid = getString(message, 'streamSid');
  const chunk = media ? getNumberOrString(media, 'chunk') : null;
  const track = media ? getString(media, 'track') : null;

  if (state.openAIReady && state.openAISocket && state.openAISocket.readyState === 1) {
    state.openAISocket.send(
      JSON.stringify({ type: 'input_audio_buffer.append', audio: payload })
    );

    state.log.info({
      msg: 'openai audio append sent',
      callSid: state.queryCallSid,
      streamSid,
      chunk,
      payloadSize: payload.length,
      source: 'live'
    });
  } else {
    state.pendingAudio.push({ payload, streamSid, chunk, track });

    state.log.info({
      msg: 'openai audio append queued',
      callSid: state.queryCallSid,
      streamSid,
      chunk,
      payloadSize: payload.length
    });
  }
}

export async function handleStop(
  message: JsonRecord,
  state: SessionState,
  events: EventPersistence,
  size: number
): Promise<void> {
  const stop = isRecord(message.stop) ? message.stop : null;
  const stopCallSid = (stop ? getString(stop, 'callSid') : null) ?? state.queryCallSid ?? null;
  const stopStreamSid = stop ? getString(stop, 'streamSid') : null;

  await events.persistEvent('twilio.media.stop', {
    callSid: stopCallSid,
    streamSid: stopStreamSid,
    size
  });

  const context = await events.ensureCallContext();
  if (context) {
    await prisma.call.updateMany({
      where: {
        id: context.callId,
        status: { in: ['RINGING', 'IN_PROGRESS'] }
      },
      data: {
        status: 'COMPLETED',
        endedAt: new Date()
      }
    });
  }

  state.log.info({
    msg: 'media stream stop received',
    callSid: stopCallSid,
    streamSid: stopStreamSid
  });

  if (state.openAIReady && state.openAISocket && state.openAISocket.readyState === 1) {
    state.openAISocket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));

    await events.persistEvent('openai.input_audio_buffer.commit.sent', {
      callSid: stopCallSid,
      streamSid: stopStreamSid,
      source: 'live'
    });

    state.log.info({
      msg: 'openai input_audio_buffer.commit sent',
      callSid: stopCallSid,
      streamSid: stopStreamSid,
      source: 'live'
    });

    state.openAISocket.send(
      JSON.stringify({
        type: 'response.create',
        response: {
          instructions: 'Respond naturally, briefly, and only in English to the caller.'
        }
      })
    );

    await events.persistEvent('openai.response.create.sent', {
      callSid: stopCallSid,
      streamSid: stopStreamSid,
      source: 'live'
    });

    state.log.info({
      msg: 'openai response.create sent',
      callSid: stopCallSid,
      streamSid: stopStreamSid,
      source: 'live'
    });
  } else {
    state.pendingResponseTrigger = { callSid: stopCallSid, streamSid: stopStreamSid };

    await events.persistEvent('openai.response.trigger.queued', {
      callSid: stopCallSid,
      streamSid: stopStreamSid
    });

    state.log.info({
      msg: 'openai response trigger queued',
      callSid: stopCallSid,
      streamSid: stopStreamSid
    });
  }
}
