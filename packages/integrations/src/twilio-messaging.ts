export type SendTwilioSmsInput = {
  accountSid: string;
  authToken: string;
  fromE164: string;
  toE164: string;
  body: string;
};

export type SendTwilioSmsResult = {
  messageSid: string | null;
};

export async function sendTwilioSms(input: SendTwilioSmsInput): Promise<SendTwilioSmsResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(input.accountSid)}/Messages.json`;
  const auth = Buffer.from(`${input.accountSid}:${input.authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      To: input.toE164,
      From: input.fromE164,
      Body: input.body
    }).toString()
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Twilio SMS send failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`
    );
  }

  const body = (await response.json().catch(() => null)) as { sid?: string } | null;

  return {
    messageSid: body?.sid ?? null
  };
}
