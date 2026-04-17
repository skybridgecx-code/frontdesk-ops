import OpenAI from 'openai';
import WebSocket from 'ws';

const TURN_DETECTION_THRESHOLD = 0.7;
const TURN_DETECTION_PREFIX_PADDING_MS = 400;
const TURN_DETECTION_SILENCE_DURATION_MS = 900;

const VOICE_TURN_TAKING_GUIDANCE = [
  'Voice behavior rules:',
  '1) Wait until the caller fully finishes speaking before responding.',
  '2) Keep every response short: 1-2 sentences unless the caller asks for more detail.',
  '3) Ask at most one follow-up question at a time, then pause and wait.',
  '4) Do not interrupt or speak over the caller.',
  '5) Avoid long monologues.'
].join('\n');

function buildSessionInstructions(systemPrompt: string) {
  const trimmedPrompt = systemPrompt.trim();
  if (trimmedPrompt.length === 0) {
    return VOICE_TURN_TAKING_GUIDANCE;
  }
  return `${trimmedPrompt}\n\n${VOICE_TURN_TAKING_GUIDANCE}`;
}

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  return new OpenAI({
    apiKey
  });
}

export function getRealtimeModel() {
  return process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime';
}

export function buildRealtimeSessionConfig(input: {
  systemPrompt: string;
  voice?: string | null;
}) {
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      model: getRealtimeModel(),
      instructions: buildSessionInstructions(input.systemPrompt),
      audio: {
        input: {
          format: {
            type: 'audio/pcmu'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: TURN_DETECTION_THRESHOLD,
            prefix_padding_ms: TURN_DETECTION_PREFIX_PADDING_MS,
            silence_duration_ms: TURN_DETECTION_SILENCE_DURATION_MS
          },
          transcription: {
            model: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe'
          }
        },
        output: {
          format: {
            type: 'audio/pcmu'
          },
          voice: input.voice ?? 'alloy'
        }
      }
    }
  } as const;
}

export function connectOpenAIRealtimeWebSocket() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(getRealtimeModel())}`;

  return new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
}
