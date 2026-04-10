import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resendSendMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn()
}));

vi.mock('resend', () => {
  class ResendMock {
    emails = {
      send: resendSendMock
    };

    constructor(_apiKey: string) {}
  }

  return {
    Resend: ResendMock
  };
});

const ORIGINAL_ENV = { ...process.env };

async function loadEmailSenderModule() {
  vi.resetModules();
  return import('../email-sender.js');
}

describe('email sender', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resendSendMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('sendEmail returns false when RESEND_API_KEY not set', async () => {
    delete process.env.RESEND_API_KEY;

    const { sendEmail } = await loadEmailSenderModule();

    const result = await sendEmail({
      to: 'owner@example.com',
      subject: 'Test',
      html: '<p>Hello</p>'
    });

    expect(result).toBe(false);
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('sendEmail calls resend.emails.send with correct params', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    resendSendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    const { sendEmail } = await loadEmailSenderModule();

    await sendEmail({
      to: 'owner@example.com',
      subject: 'Billing update',
      html: '<p>Hello</p>'
    });

    expect(resendSendMock).toHaveBeenCalledWith({
      from: 'SkybridgeCX <notifications@skybridgecx.co>',
      to: 'owner@example.com',
      subject: 'Billing update',
      html: '<p>Hello</p>'
    });
  });

  it('sendEmail returns true on success', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    resendSendMock.mockResolvedValue({ data: { id: 'email_2' }, error: null });

    const { sendEmail } = await loadEmailSenderModule();

    const result = await sendEmail({
      to: 'owner@example.com',
      subject: 'Success',
      html: '<p>OK</p>'
    });

    expect(result).toBe(true);
  });

  it('sendEmail returns false and logs error on failure', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    resendSendMock.mockResolvedValue({ data: null, error: { message: 'bad request' } });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendEmail } = await loadEmailSenderModule();

    const result = await sendEmail({
      to: 'owner@example.com',
      subject: 'Failure',
      html: '<p>Fail</p>'
    });

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('sendWelcomeEmail uses welcome template', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    resendSendMock.mockResolvedValue({ data: { id: 'email_3' }, error: null });

    const { sendWelcomeEmail } = await loadEmailSenderModule();

    await sendWelcomeEmail('owner@example.com', 'Aatif', 'Skybridge Plumbing');

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('Welcome'),
        html: expect.stringContaining('Hi Aatif')
      })
    );
  });

  it('sendMissedCallEmail uses missed call template', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    resendSendMock.mockResolvedValue({ data: { id: 'email_4' }, error: null });

    const { sendMissedCallEmail } = await loadEmailSenderModule();

    await sendMissedCallEmail('owner@example.com', {
      businessName: 'Skybridge Plumbing',
      callerPhone: '+12125551234',
      callerName: 'John Smith',
      callTime: '2026-04-10T12:00:00.000Z',
      callId: 'call_1'
    });

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('Missed call'),
        html: expect.stringContaining('View Call Details')
      })
    );
  });

  it('sendVoicemailEmail uses voicemail template', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    resendSendMock.mockResolvedValue({ data: { id: 'email_5' }, error: null });

    const { sendVoicemailEmail } = await loadEmailSenderModule();

    await sendVoicemailEmail('owner@example.com', {
      businessName: 'Skybridge Plumbing',
      callerPhone: '+12125551234',
      callerName: 'Jane',
      callReason: 'Need AC repair',
      voicemailDuration: 22,
      callTime: '2026-04-10T12:00:00.000Z',
      callId: 'call_2'
    });

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('voicemail'),
        html: expect.stringContaining('Listen to Voicemail')
      })
    );
  });

  it('sendPaymentConfirmationEmail uses payment template', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    resendSendMock.mockResolvedValue({ data: { id: 'email_6' }, error: null });

    const { sendPaymentConfirmationEmail } = await loadEmailSenderModule();

    await sendPaymentConfirmationEmail('owner@example.com', {
      name: 'Aatif',
      planName: 'Pro',
      amount: '499'
    });

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('Payment confirmed'),
        html: expect.stringContaining('$499/mo')
      })
    );
  });

  it('sendPaymentFailedEmail uses payment failed template', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    resendSendMock.mockResolvedValue({ data: { id: 'email_7' }, error: null });

    const { sendPaymentFailedEmail } = await loadEmailSenderModule();

    await sendPaymentFailedEmail('owner@example.com', {
      name: 'Aatif',
      planName: 'Pro'
    });

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('Payment failed'),
        html: expect.stringContaining('Update Payment Method')
      })
    );
  });
});
