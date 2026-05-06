import assert from 'node:assert/strict';
import test from 'node:test';
import { getVoiceReadinessModel, VOICE_READINESS_PHONE_NUMBER } from './voice-readiness';

test('voice readiness model keeps routing healthy and quota blocker explicit', () => {
  const model = getVoiceReadinessModel();

  assert.equal(model.title, 'Realtime Voice Status');
  assert.match(model.summary, /routing is operational end-to-end/i);
  assert.match(model.summary, /not Twilio, DigitalOcean, DB mapping, or stream routing/i);
  assert.match(model.blocker, /OpenAI API quota/i);

  const byLabel = new Map(model.signals.map((signal) => [signal.label, signal]));
  assert.equal(byLabel.get('Twilio inbound configured')?.tone, 'confirmed');
  assert.equal(byLabel.get('Phone number mapped')?.tone, 'confirmed');
  assert.equal(byLabel.get('Routing mode: AI_ALWAYS')?.tone, 'confirmed');
  assert.equal(byLabel.get('Realtime gateway connected')?.tone, 'confirmed');
  assert.equal(byLabel.get('OpenAI response.create reached')?.tone, 'confirmed');
  assert.equal(byLabel.get('OpenAI API quota / billing credits')?.tone, 'blocked');

  assert.ok(
    model.checklist.some((item) => item.includes(VOICE_READINESS_PHONE_NUMBER)),
    'checklist should include the operator retest phone number'
  );
  assert.ok(model.checklist.some((item) => item.includes('openai.output_audio.delta received')));
  assert.ok(model.checklist.some((item) => item.includes('twilio outbound media sent')));
});
