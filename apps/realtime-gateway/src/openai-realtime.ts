import OpenAI from 'openai';
import WebSocket from 'ws';

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
      instructions: input.systemPrompt,
      audio: {
        input: {
          format: {
            type: 'audio/pcmu'
          },
          turn_detection: {
            type: 'server_vad'
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
