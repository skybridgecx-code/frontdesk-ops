import OpenAI from 'openai';

export type ExtractedCallData = {
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: 'low' | 'medium' | 'high' | 'emergency' | null;
  serviceAddress: string | null;
  summary: string | null;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  return new OpenAI({
    apiKey
  });
}

function cleanNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function extractCallData(input: {
  callerTranscript: string | null;
  assistantTranscript: string | null;
}) {
  const client = getOpenAIClient();

  const transcriptBlock = [
    `Caller transcript: ${input.callerTranscript ?? ''}`,
    `Assistant transcript: ${input.assistantTranscript ?? ''}`
  ].join('\n\n');

  const response = await client.responses.create({
    model: process.env.OPENAI_EXTRACTION_MODEL ?? 'gpt-5-mini',
    store: false,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'Extract structured lead data from a phone call. Return only fields directly supported by the transcript. Do not guess. If a field is missing or unclear, return null.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: transcriptBlock
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'call_extraction',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            leadName: { type: ['string', 'null'] },
            leadPhone: { type: ['string', 'null'] },
            leadIntent: { type: ['string', 'null'] },
            urgency: {
              type: ['string', 'null'],
              enum: ['low', 'medium', 'high', 'emergency', null]
            },
            serviceAddress: { type: ['string', 'null'] },
            summary: { type: ['string', 'null'] }
          },
          required: [
            'leadName',
            'leadPhone',
            'leadIntent',
            'urgency',
            'serviceAddress',
            'summary'
          ]
        }
      }
    }
  } as never);

  const parsed = JSON.parse(response.output_text) as Record<string, unknown>;

  return {
    leadName: cleanNullableString(parsed.leadName),
    leadPhone: cleanNullableString(parsed.leadPhone),
    leadIntent: cleanNullableString(parsed.leadIntent),
    urgency:
      parsed.urgency === 'low' ||
      parsed.urgency === 'medium' ||
      parsed.urgency === 'high' ||
      parsed.urgency === 'emergency'
        ? parsed.urgency
        : null,
    serviceAddress: cleanNullableString(parsed.serviceAddress),
    summary: cleanNullableString(parsed.summary)
  } satisfies ExtractedCallData;
}
