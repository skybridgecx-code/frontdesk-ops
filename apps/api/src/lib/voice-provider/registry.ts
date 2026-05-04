import type { VoiceProvider, VoiceProviderAdapter } from './index.js';
import { twilioVoiceProviderAdapter } from './twilio.js';
import { retellVoiceProviderAdapter } from './retell.js';
import { telnyxVoiceProviderAdapter } from './telnyx.js';

const registry: Record<VoiceProvider, VoiceProviderAdapter> = {
  twilio: twilioVoiceProviderAdapter,
  retell: retellVoiceProviderAdapter,
  telnyx: telnyxVoiceProviderAdapter
};

export function getVoiceProviderAdapter(provider: VoiceProvider): VoiceProviderAdapter {
  return registry[provider];
}
