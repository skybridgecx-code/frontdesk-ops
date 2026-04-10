type WelcomeEmailParams = {
  name: string;
  businessName: string | null;
};

type MissedCallEmailParams = {
  businessName: string;
  callerPhone: string;
  callerName: string | null;
  callTime: string;
  callId: string;
};

type VoicemailEmailParams = {
  businessName: string;
  callerPhone: string;
  callerName: string | null;
  callReason: string | null;
  voicemailDuration: number | null;
  callTime: string;
  callId: string;
};

type PaymentConfirmationEmailParams = {
  name: string;
  planName: string;
  amount: string;
};

type PaymentFailedEmailParams = {
  name: string;
  planName: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function detailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 12px 8px 0;color:#6b7280;font-size:14px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:500;">${escapeHtml(value)}</td>
  </tr>`;
}

function detailsCard(rows: string) {
  return `<div style="border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;padding:16px;margin:20px 0;">
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
  </div>`;
}

function footerNote() {
  return `<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:20px 0 0;">
    Need help? Reply to this email or visit skybridgecx.co
  </p>`;
}

export function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#2563eb;padding:24px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:20px;">SkybridgeCX</h1>
      </div>
      <div style="padding:32px 24px;">
        ${content}
      </div>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px;">
      © 2025 SkybridgeCX · skybridgecx.co
    </p>
  </div>
</body>
</html>`;
}

export function ctaButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${escapeHtml(url)}" style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
      ${escapeHtml(text)}
    </a>
  </div>`;
}

export function welcomeEmail(params: WelcomeEmailParams) {
  const recipientName = params.name.trim().length > 0 ? params.name.trim() : 'there';
  const businessName =
    params.businessName && params.businessName.trim().length > 0
      ? params.businessName.trim()
      : 'your business';

  const content = `
    <p style="font-size:16px;color:#111827;line-height:1.6;margin:0 0 16px;">Hi ${escapeHtml(recipientName)},</p>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px;">
      Welcome to SkybridgeCX! Your AI receptionist is ready to help ${escapeHtml(businessName)} never miss a call.
    </p>
    <p style="font-size:15px;color:#111827;font-weight:600;margin:0 0 10px;">Quick start:</p>
    <ol style="margin:0 0 16px 20px;padding:0;color:#374151;font-size:14px;line-height:1.8;">
      <li>Complete your setup at skybridgecx.co/welcome</li>
      <li>Customize your AI greeting</li>
      <li>Get your phone number</li>
      <li>Start receiving calls</li>
    </ol>
    ${ctaButton('Go to Dashboard', 'https://skybridgecx.co/dashboard')}
    ${footerNote()}
  `;

  return {
    subject: 'Welcome to SkybridgeCX! 🎉',
    html: emailWrapper(content)
  };
}

export function missedCallEmail(params: MissedCallEmailParams) {
  const callerLabel =
    params.callerName && params.callerName.trim().length > 0
      ? params.callerName.trim()
      : params.callerPhone;

  const content = `
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">📞 Missed Call Alert</h2>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">
      Your AI receptionist at ${escapeHtml(params.businessName)} missed a call.
    </p>
    ${detailsCard(
      [
        detailRow('Caller', callerLabel),
        detailRow('Phone', params.callerPhone),
        detailRow('Time', params.callTime)
      ].join('')
    )}
    ${ctaButton('View Call Details', `https://skybridgecx.co/calls/${encodeURIComponent(params.callId)}`)}
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;">
      Your caller was sent an automatic text-back message.
    </p>
    ${footerNote()}
  `;

  return {
    subject: `Missed call from ${callerLabel}`,
    html: emailWrapper(content)
  };
}

export function voicemailEmail(params: VoicemailEmailParams) {
  const callerLabel =
    params.callerName && params.callerName.trim().length > 0
      ? params.callerName.trim()
      : params.callerPhone;

  const reasonLabel =
    params.callReason && params.callReason.trim().length > 0
      ? params.callReason.trim()
      : 'Not captured';

  const durationLabel =
    typeof params.voicemailDuration === 'number' && Number.isFinite(params.voicemailDuration)
      ? `${params.voicemailDuration}s`
      : 'Unknown';

  const content = `
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">🎤 New Voicemail</h2>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">
      Someone left a voicemail for ${escapeHtml(params.businessName)}.
    </p>
    ${detailsCard(
      [
        detailRow('Caller', callerLabel),
        detailRow('Phone', params.callerPhone),
        detailRow('Reason', reasonLabel),
        detailRow('Duration', durationLabel),
        detailRow('Time', params.callTime)
      ].join('')
    )}
    ${ctaButton('Listen to Voicemail', `https://skybridgecx.co/calls/${encodeURIComponent(params.callId)}`)}
    ${footerNote()}
  `;

  return {
    subject: `New voicemail from ${callerLabel}`,
    html: emailWrapper(content)
  };
}

export function paymentConfirmationEmail(params: PaymentConfirmationEmailParams) {
  const recipientName = params.name.trim().length > 0 ? params.name.trim() : 'there';

  const content = `
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">✅ Payment Confirmed</h2>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px;">
      Hi ${escapeHtml(recipientName)}, your payment for the ${escapeHtml(params.planName)} plan ($${escapeHtml(
        params.amount
      )}/mo) has been processed.
    </p>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">Your AI receptionist is fully active.</p>
    ${ctaButton('Go to Dashboard', 'https://skybridgecx.co/dashboard')}
    ${footerNote()}
  `;

  return {
    subject: `Payment confirmed — ${params.planName} plan`,
    html: emailWrapper(content)
  };
}

export function paymentFailedEmail(params: PaymentFailedEmailParams) {
  const recipientName = params.name.trim().length > 0 ? params.name.trim() : 'there';

  const content = `
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">⚠️ Payment Failed</h2>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px;">
      Hi ${escapeHtml(recipientName)}, we couldn't process your payment for the ${escapeHtml(params.planName)} plan.
    </p>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">
      Your AI receptionist will be paused if payment isn't updated within 3 days.
    </p>
    ${ctaButton('Update Payment Method', 'https://skybridgecx.co/billing')}
    ${footerNote()}
  `;

  return {
    subject: '⚠️ Payment failed — action needed',
    html: emailWrapper(content)
  };
}
