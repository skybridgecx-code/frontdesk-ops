import { describe, expect, it } from 'vitest';
import {
  missedCallEmail,
  paymentConfirmationEmail,
  paymentFailedEmail,
  voicemailEmail,
  welcomeEmail
} from '../email-templates.js';

function expectValidHtmlDocument(html: string) {
  expect(html).toContain('<!DOCTYPE html>');
  expect(html).toContain('</html>');
  expect(html).toContain('SkybridgeCX');
}

describe('email templates', () => {
  it('welcomeEmail returns subject containing Welcome', () => {
    const template = welcomeEmail({
      name: 'Aatif',
      businessName: 'Skybridge Plumbing'
    });

    expect(template.subject).toContain('Welcome');
  });

  it('welcomeEmail html contains the user name', () => {
    const template = welcomeEmail({
      name: 'Aatif',
      businessName: 'Skybridge Plumbing'
    });

    expect(template.html).toContain('Hi Aatif');
  });

  it('welcomeEmail html contains dashboard link', () => {
    const template = welcomeEmail({
      name: 'Aatif',
      businessName: 'Skybridge Plumbing'
    });

    expect(template.html).toContain('https://skybridgecx.co/dashboard');
  });

  it('missedCallEmail subject contains caller info', () => {
    const template = missedCallEmail({
      businessName: 'Skybridge Plumbing',
      callerPhone: '+12125551234',
      callerName: 'John Smith',
      callTime: '2026-04-10T12:00:00.000Z',
      callId: 'call_123'
    });

    expect(template.subject).toContain('John Smith');
  });

  it('missedCallEmail html contains caller phone and call time', () => {
    const template = missedCallEmail({
      businessName: 'Skybridge Plumbing',
      callerPhone: '+12125551234',
      callerName: null,
      callTime: '2026-04-10T12:00:00.000Z',
      callId: 'call_123'
    });

    expect(template.html).toContain('+12125551234');
    expect(template.html).toContain('2026-04-10T12:00:00.000Z');
  });

  it('missedCallEmail html contains call detail link', () => {
    const template = missedCallEmail({
      businessName: 'Skybridge Plumbing',
      callerPhone: '+12125551234',
      callerName: null,
      callTime: '2026-04-10T12:00:00.000Z',
      callId: 'call_abc123'
    });

    expect(template.html).toContain('https://skybridgecx.co/calls/call_abc123');
  });

  it('voicemailEmail subject contains caller info', () => {
    const template = voicemailEmail({
      businessName: 'Skybridge Plumbing',
      callerPhone: '+12125551234',
      callerName: 'Jane Doe',
      callReason: 'Need plumbing repair',
      voicemailDuration: 45,
      callTime: '2026-04-10T12:00:00.000Z',
      callId: 'call_234'
    });

    expect(template.subject).toContain('Jane Doe');
  });

  it('voicemailEmail html contains voicemail duration', () => {
    const template = voicemailEmail({
      businessName: 'Skybridge Plumbing',
      callerPhone: '+12125551234',
      callerName: null,
      callReason: null,
      voicemailDuration: 31,
      callTime: '2026-04-10T12:00:00.000Z',
      callId: 'call_345'
    });

    expect(template.html).toContain('31s');
  });

  it('voicemailEmail html contains call detail link', () => {
    const template = voicemailEmail({
      businessName: 'Skybridge Plumbing',
      callerPhone: '+12125551234',
      callerName: null,
      callReason: null,
      voicemailDuration: null,
      callTime: '2026-04-10T12:00:00.000Z',
      callId: 'call_678'
    });

    expect(template.html).toContain('https://skybridgecx.co/calls/call_678');
  });

  it('paymentConfirmationEmail subject contains plan name', () => {
    const template = paymentConfirmationEmail({
      name: 'Aatif',
      planName: 'Pro',
      amount: '499'
    });

    expect(template.subject).toContain('Pro');
  });

  it('paymentConfirmationEmail html contains amount', () => {
    const template = paymentConfirmationEmail({
      name: 'Aatif',
      planName: 'Pro',
      amount: '499'
    });

    expect(template.html).toContain('$499/mo');
  });

  it('paymentFailedEmail subject contains failed', () => {
    const template = paymentFailedEmail({
      name: 'Aatif',
      planName: 'Pro'
    });

    expect(template.subject.toLowerCase()).toContain('failed');
  });

  it('paymentFailedEmail html contains billing link', () => {
    const template = paymentFailedEmail({
      name: 'Aatif',
      planName: 'Pro'
    });

    expect(template.html).toContain('https://skybridgecx.co/billing');
  });

  it('all templates return valid html and include branding', () => {
    const templates = [
      welcomeEmail({ name: 'Aatif', businessName: 'Skybridge Plumbing' }),
      missedCallEmail({
        businessName: 'Skybridge Plumbing',
        callerPhone: '+12125551234',
        callerName: 'John Smith',
        callTime: '2026-04-10T12:00:00.000Z',
        callId: 'call_1'
      }),
      voicemailEmail({
        businessName: 'Skybridge Plumbing',
        callerPhone: '+12125551234',
        callerName: 'John Smith',
        callReason: 'Need AC repair',
        voicemailDuration: 14,
        callTime: '2026-04-10T12:00:00.000Z',
        callId: 'call_2'
      }),
      paymentConfirmationEmail({ name: 'Aatif', planName: 'Starter', amount: '299' }),
      paymentFailedEmail({ name: 'Aatif', planName: 'Starter' })
    ];

    for (const template of templates) {
      expectValidHtmlDocument(template.html);
    }
  });
});
