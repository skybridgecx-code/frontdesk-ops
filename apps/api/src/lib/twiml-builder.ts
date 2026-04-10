function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapResponse(content: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`;
}

export function buildGreetingTwiml(businessName: string, greeting: string | null): string {
  const safeBusinessName = businessName.trim().length > 0 ? businessName.trim() : 'our office';
  const greetingText =
    greeting && greeting.trim().length > 0
      ? greeting.trim()
      : `Thanks for calling ${safeBusinessName}. How can we help you today?`;

  return wrapResponse(
    `<Say voice="Polly.Joanna">${escapeXml(greetingText)}</Say>` +
      '<Gather input="speech" action="/v1/twilio/voice/collect-name" method="POST" speechTimeout="auto" language="en-US">' +
      '<Say voice="Polly.Joanna">Please tell us your name after the beep.</Say>' +
      '</Gather>' +
      '<Say voice="Polly.Joanna">We didn\'t catch that.</Say>' +
      '<Redirect method="POST">/v1/twilio/voice/collect-name</Redirect>'
  );
}

export function buildCollectReasonTwiml(callerName: string): string {
  const safeCallerName = callerName.trim().length > 0 ? callerName.trim() : 'there';

  return wrapResponse(
    `<Say voice="Polly.Joanna">Thanks ${escapeXml(safeCallerName)}. How can we help you today?</Say>` +
      '<Gather input="speech" action="/v1/twilio/voice/collect-reason" method="POST" speechTimeout="auto" language="en-US">' +
      '<Say voice="Polly.Joanna">Please tell us what you need help with after the beep.</Say>' +
      '</Gather>' +
      '<Say voice="Polly.Joanna">We didn\'t catch that.</Say>' +
      '<Redirect method="POST">/v1/twilio/voice/collect-reason</Redirect>'
  );
}

export function buildThankYouTwiml(callerName: string, businessName: string): string {
  const safeCallerName = callerName.trim().length > 0 ? callerName.trim() : 'there';
  const safeBusinessName = businessName.trim().length > 0 ? businessName.trim() : 'our office';

  return wrapResponse(
    `<Say voice="Polly.Joanna">Thank you ${escapeXml(safeCallerName)}. Someone from ${escapeXml(safeBusinessName)} will get back to you shortly. If you'd like to leave a voicemail, please stay on the line after the beep. Otherwise, you can hang up now.</Say>` +
      '<Record maxLength="120" action="/v1/twilio/voice/voicemail-complete" method="POST" playBeep="true" transcribe="true" />' +
      '<Say voice="Polly.Joanna">Goodbye!</Say>' +
      '<Hangup/>'
  );
}

export function buildVoicemailCompleteTwiml(): string {
  return wrapResponse(
    '<Say voice="Polly.Joanna">Thank you for your message. Goodbye!</Say>' + '<Hangup/>'
  );
}

export function buildErrorTwiml(): string {
  return wrapResponse(
    '<Say voice="Polly.Joanna">We\'re sorry, something went wrong. Please try calling again later.</Say>' +
      '<Hangup/>'
  );
}
