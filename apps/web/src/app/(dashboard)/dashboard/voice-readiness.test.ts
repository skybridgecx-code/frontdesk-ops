import assert from 'node:assert/strict';
import test from 'node:test';
import { getVoiceReadinessModel, getVoiceSimulationModel, VOICE_READINESS_PHONE_NUMBER } from './voice-readiness';

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

test('voice simulation model stays demo-safe and quota-blocker specific', () => {
  const model = getVoiceSimulationModel();

  assert.equal(model.title, 'Voice Simulation Mode');
  assert.match(model.summary, /demo-safe visualization/i);
  assert.match(model.disclaimer, /simulation only/i);
  assert.doesNotMatch(model.disclaimer, /real caller heard ai/i);

  const byLabel = new Map(model.steps.map((step) => [step.label, step]));
  assert.equal(byLabel.get('Inbound call received')?.status, 'confirmed');
  assert.equal(byLabel.get('Phone number matched')?.status, 'confirmed');
  assert.equal(byLabel.get('Routing mode AI_ALWAYS')?.status, 'confirmed');
  assert.equal(byLabel.get('Realtime gateway connected')?.status, 'confirmed');
  assert.equal(byLabel.get('OpenAI response.create reached')?.status, 'confirmed');
  assert.equal(byLabel.get('Blocker shown: OpenAI quota')?.status, 'blocked');
  assert.equal(byLabel.get('Next expected step')?.status, 'next');
  assert.match(byLabel.get('Next expected step')?.detail ?? '', /output_audio\.delta/i);
  assert.match(byLabel.get('Next expected step')?.detail ?? '', /twilio outbound media sent/i);
});
