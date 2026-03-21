import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { prisma } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';

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

    socket.on('message', (raw: WsRaw) => {
      pending = pending.then(async () => {
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

          await persistEvent('twilio.media.media', {
            callSid: queryCallSid,
            streamSid: getString(message, 'streamSid'),
            track: media ? getString(media, 'track') : null,
            chunk: media ? getNumberOrString(media, 'chunk') : null,
            timestamp: media ? getNumberOrString(media, 'timestamp') : null,
            payloadSize: media ? (getString(media, 'payload')?.length ?? 0) : 0,
            size
          });

          app.log.info({
            msg: 'media stream media received',
            callSid: queryCallSid,
            streamSid: getString(message, 'streamSid'),
            chunk: media ? getNumberOrString(media, 'chunk') : null,
            track: media ? getString(media, 'track') : null
          });

          return;
        }

        if (event === 'stop') {
          const stop = isRecord(message.stop) ? message.stop : null;

          await persistEvent('twilio.media.stop', {
            callSid: stop ? getString(stop, 'callSid') ?? queryCallSid ?? null : queryCallSid ?? null,
            streamSid: stop ? getString(stop, 'streamSid') : null,
            size
          });

          app.log.info({
            msg: 'media stream stop received',
            callSid: stop ? getString(stop, 'callSid') ?? queryCallSid ?? null : queryCallSid ?? null,
            streamSid: stop ? getString(stop, 'streamSid') : null
          });

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
      }).catch((error: unknown) => {
        app.log.error({
          msg: 'media stream handler failed',
          callSid: queryCallSid,
          error
        });
      });
    });

    socket.on('close', () => {
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
