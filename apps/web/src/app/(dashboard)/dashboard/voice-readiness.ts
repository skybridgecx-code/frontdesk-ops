export type VoiceReadinessTone = 'confirmed' | 'blocked';

export type VoiceReadinessSignal = {
  label: string;
  tone: VoiceReadinessTone;
  detail: string;
};

export type VoiceReadinessModel = {
  title: string;
  summary: string;
  blocker: string;
  signals: VoiceReadinessSignal[];
  checklist: string[];
};

export type VoiceSimulationStatus = 'confirmed' | 'blocked' | 'next';

export type VoiceSimulationStep = {
  label: string;
  status: VoiceSimulationStatus;
  detail: string;
};

export type VoiceSimulationModel = {
  title: string;
  summary: string;
  disclaimer: string;
  steps: VoiceSimulationStep[];
};

export const VOICE_READINESS_PHONE_NUMBER = '+1 202 935 9687';

export function getVoiceReadinessModel(): VoiceReadinessModel {
  return {
    title: 'Realtime Voice Status',
    summary:
      'Realtime voice routing is operational end-to-end. The active blocker is OpenAI API quota/credits, not Twilio, DigitalOcean, DB mapping, or stream routing.',
    blocker: 'Current blocker: OpenAI API quota / billing credits',
    signals: [
      { label: 'Twilio inbound configured', tone: 'confirmed', detail: 'Inbound voice webhooks are receiving live call traffic.' },
      { label: 'Phone number mapped', tone: 'confirmed', detail: 'The configured phone number resolves to the tenant in the database.' },
      { label: 'Routing mode: AI_ALWAYS', tone: 'confirmed', detail: 'Inbound calls are routed to the AI path by policy.' },
      { label: 'Realtime gateway connected', tone: 'confirmed', detail: 'TwiML stream targets the realtime gateway and media frames are received.' },
      { label: 'OpenAI response.create reached', tone: 'confirmed', detail: 'Initial response creation is attempted by the gateway.' },
      { label: 'OpenAI API quota / billing credits', tone: 'blocked', detail: 'Provider is returning insufficient quota; caller audio output is blocked until credits are added.' }
    ],
    checklist: [
      'Add OpenAI API credits.',
      `Call ${VOICE_READINESS_PHONE_NUMBER}.`,
      'Confirm log: openai.output_audio.delta received.',
      'Confirm log: twilio outbound media sent.'
    ]
  };
}

export function getVoiceSimulationModel(): VoiceSimulationModel {
  return {
    title: 'Voice Simulation Mode',
    summary: 'Demo-safe visualization of the current voice lifecycle when OpenAI quota blocks live audio output.',
    disclaimer: 'Simulation only. This does not mean a real caller heard AI audio.',
    steps: [
      {
        label: 'Inbound call received',
        status: 'confirmed',
        detail: 'Twilio inbound webhook reaches the API.'
      },
      {
        label: 'Phone number matched',
        status: 'confirmed',
        detail: 'The inbound number resolves to the tenant record.'
      },
      {
        label: 'Routing mode AI_ALWAYS',
        status: 'confirmed',
        detail: 'Calls route to the AI workflow by policy.'
      },
      {
        label: 'Realtime gateway connected',
        status: 'confirmed',
        detail: 'Twilio media stream reaches the realtime gateway.'
      },
      {
        label: 'OpenAI response.create reached',
        status: 'confirmed',
        detail: 'Initial response creation is triggered by the realtime gateway.'
      },
      {
        label: 'Blocker shown: OpenAI quota',
        status: 'blocked',
        detail: 'Provider returns insufficient_quota until credits are added.'
      },
      {
        label: 'Next expected step',
        status: 'next',
        detail: 'After credits: observe openai.output_audio.delta and twilio outbound media sent.'
      }
    ]
  };
}
