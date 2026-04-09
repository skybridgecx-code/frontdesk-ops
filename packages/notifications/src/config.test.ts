import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('notification config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('isNotificationsConfigured returns false when no env vars set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('NOTIFICATION_EMAILS', '');
    const { isNotificationsConfigured } = await import('./config.js');
    expect(isNotificationsConfigured()).toBe(false);
  });

  it('isNotificationsConfigured returns false when only API key set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubEnv('NOTIFICATION_EMAILS', '');
    const { isNotificationsConfigured } = await import('./config.js');
    expect(isNotificationsConfigured()).toBe(false);
  });

  it('isNotificationsConfigured returns true when both set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubEnv('NOTIFICATION_EMAILS', 'test@example.com');
    const { isNotificationsConfigured } = await import('./config.js');
    expect(isNotificationsConfigured()).toBe(true);
  });

  it('getNotificationEmails parses comma-separated list', async () => {
    vi.stubEnv('NOTIFICATION_EMAILS', ' alice@test.com , bob@test.com , , invalid , carol@test.com ');
    const { getNotificationEmails } = await import('./config.js');
    expect(getNotificationEmails()).toEqual(['alice@test.com', 'bob@test.com', 'carol@test.com']);
  });

  it('getNotificationEmails returns empty array for empty string', async () => {
    vi.stubEnv('NOTIFICATION_EMAILS', '');
    const { getNotificationEmails } = await import('./config.js');
    expect(getNotificationEmails()).toEqual([]);
  });

  it('getFromAddress returns default when env var is not set', async () => {
    delete process.env.NOTIFICATION_FROM_EMAIL;
    const { getFromAddress } = await import('./config.js');
    expect(getFromAddress()).toContain('Frontdesk OS');
  });

  it('getFromAddress returns custom when set', async () => {
    vi.stubEnv('NOTIFICATION_FROM_EMAIL', 'Custom <custom@example.com>');
    const { getFromAddress } = await import('./config.js');
    expect(getFromAddress()).toBe('Custom <custom@example.com>');
  });

  it('getDashboardUrl strips trailing slash', async () => {
    vi.stubEnv('FRONTDESK_WEB_URL', 'https://app.example.com/');
    const { getDashboardUrl } = await import('./config.js');
    expect(getDashboardUrl()).toBe('https://app.example.com');
  });
});
