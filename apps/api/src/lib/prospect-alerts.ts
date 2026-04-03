type ProspectCreatedAlertInput = {
  businessId: string;
  prospectSid: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  sourceLabel: string;
  createdAt: string;
};

function getSlackWebhookUrl() {
  const value = process.env.PROSPECT_ALERT_SLACK_WEBHOOK_URL?.trim();
  return value ? value : null;
}

export async function sendProspectCreatedAlert(input: ProspectCreatedAlertInput) {
  const webhookUrl = getSlackWebhookUrl();

  if (!webhookUrl) {
    return { sent: false as const, reason: 'missing_webhook' as const };
  }

  const lines = [
    'New prospect created',
    `businessId: ${input.businessId}`,
    `prospectSid: ${input.prospectSid}`,
    `companyName: ${input.companyName}`,
    `contactName: ${input.contactName ?? '-'}`,
    `contactEmail: ${input.contactEmail ?? '-'}`,
    `contactPhone: ${input.contactPhone ?? '-'}`,
    `sourceLabel: ${input.sourceLabel}`,
    `createdAt: ${input.createdAt}`
  ];

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      text: lines.join('\n')
    })
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with status ${response.status}`);
  }

  return { sent: true as const };
}
