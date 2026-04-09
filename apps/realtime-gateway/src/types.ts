import type { FastifyBaseLogger } from 'fastify';
import type WebSocket from 'ws';

export type WsRaw = Buffer | ArrayBuffer | Buffer[];
export type JsonRecord = Record<string, unknown>;

/**
 * Mutable state shared across all handlers for a single WebSocket call session.
 */
export interface SessionState {
  readonly queryCallSid: string | null;
  readonly phoneNumberId: string | null;
  readonly agentProfileId: string | null;

  /** Twilio stream SID — set on `start` event */
  currentStreamSid: string | null;

  /** OpenAI item ID for the current caller utterance */
  currentInputItemId: string | null;

  /** Accumulates assistant transcript deltas until `done` */
  assistantTranscriptBuffer: string;

  /** Accumulates caller transcript deltas until `completed` */
  callerTranscriptBuffer: string;

  /** If OpenAI isn't ready yet, we queue the response trigger */
  pendingResponseTrigger: { callSid: string | null; streamSid: string | null } | null;

  /** Audio chunks queued before OpenAI WS is ready */
  pendingAudio: Array<{
    payload: string;
    streamSid: string | null;
    chunk: number | string | null;
    track: string | null;
  }>;

  /** Whether the OpenAI WS has received session.update */
  openAIReady: boolean;

  /** Reference to the OpenAI WebSocket (null until connected) */
  openAISocket: WebSocket | null;

  /** The Twilio-side WebSocket */
  readonly twilioSocket: WebSocket;

  /** Fastify logger */
  readonly log: FastifyBaseLogger;
}
