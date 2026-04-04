import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getProspectShortcutTransition,
  isProspectTerminalStatus,
  normalizeProspectNextActionAt,
  normalizeProspectStatusAfterAttempt
} from '@frontdesk/domain';

test('terminal prospect states stay terminal after attempt logging', () => {
  assert.equal(normalizeProspectStatusAfterAttempt('NEW'), 'ATTEMPTED');
  assert.equal(normalizeProspectStatusAfterAttempt('IN_PROGRESS'), 'ATTEMPTED');
  assert.equal(normalizeProspectStatusAfterAttempt('RESPONDED'), 'RESPONDED');
  assert.equal(normalizeProspectStatusAfterAttempt('ARCHIVED'), 'ARCHIVED');
  assert.equal(isProspectTerminalStatus('QUALIFIED'), true);
  assert.equal(isProspectTerminalStatus('READY'), false);
});

test('terminal workflow states always clear nextActionAt', () => {
  const nextActionAt = new Date('2026-04-05T12:00:00.000Z');

  assert.equal(normalizeProspectNextActionAt('RESPONDED', nextActionAt), null);
  assert.equal(normalizeProspectNextActionAt('ARCHIVED', nextActionAt), null);
  assert.equal(normalizeProspectNextActionAt('READY', nextActionAt), nextActionAt);
  assert.equal(normalizeProspectNextActionAt('READY', null), null);
});

test('shortcut transitions stay explicit and consistent', () => {
  const noAnswer = getProspectShortcutTransition('no-answer', 'READY');
  assert.equal(noAnswer.status, 'ATTEMPTED');
  assert.equal(noAnswer.nextActionAt instanceof Date, true);
  assert.equal(noAnswer.attempt?.outcome, 'NO_ANSWER');

  const voicemail = getProspectShortcutTransition('voicemail', 'RESPONDED');
  assert.equal(voicemail.status, 'RESPONDED');
  assert.equal(voicemail.nextActionAt, null);
  assert.equal(voicemail.attempt?.outcome, 'LEFT_VOICEMAIL');

  const responded = getProspectShortcutTransition('responded', 'READY');
  assert.equal(responded.status, 'RESPONDED');
  assert.equal(responded.nextActionAt, null);
  assert.equal(responded.attempt, undefined);
});
