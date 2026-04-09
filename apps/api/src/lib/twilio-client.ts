import twilio from 'twilio';

type TwilioClient = ReturnType<typeof twilio>;

let sharedClient: TwilioClient | null = null;

export function getTwilioClient() {
  if (sharedClient) {
    return sharedClient;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio client is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
  }

  sharedClient = twilio(accountSid, authToken);
  return sharedClient;
}
