import { createHmac } from 'node:crypto';
import { prisma } from '@frontdesk/db';

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY_CHARS = 1000;

type DispatchablePayload = Record<string, unknown>;

type DispatchEnvelope = {
  event: string;
  timestamp: string;
  data: DispatchablePayload;
};

export type WebhookDispatchEndpoint = {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
};

export type WebhookDispatchResult = {
  endpointId: string;
  deliveryId: string | null;
  eventType: string;
  success: boolean;
  statusCode: number | null;
  responseBody: string | null;
};

function truncateResponseBody(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.length <= MAX_RESPONSE_BODY_CHARS) {
    return value;
  }

  return value.slice(0, MAX_RESPONSE_BODY_CHARS);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown webhook delivery error';
}

async function readResponseBody(response: Response) {
  try {
    return truncateResponseBody(await response.text());
  } catch {
    return null;
  }
}

async function postWithTimeout(input: {
  url: string;
  body: string;
  headers: Record<string, string>;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, WEBHOOK_TIMEOUT_MS);

  try {
    return await fetch(input.url, {
      method: 'POST',
      headers: input.headers,
      body: input.body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchWebhookToEndpoint(input: {
  endpoint: WebhookDispatchEndpoint;
  eventType: string;
  payload: DispatchablePayload;
}): Promise<WebhookDispatchResult> {
  const envelope: DispatchEnvelope = {
    event: input.eventType,
    timestamp: new Date().toISOString(),
    data: input.payload
  };

  const serializedPayload = JSON.stringify(envelope);
  const timestampSeconds = Math.floor(Date.now() / 1000).toString();
  const signature = `sha256=${createHmac('sha256', input.endpoint.secret).update(serializedPayload).digest('hex')}`;

  try {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: input.endpoint.id,
        eventType: input.eventType,
        payload: serializedPayload,
        attempts: 1
      },
      select: {
        id: true
      }
    });

    try {
      const response = await postWithTimeout({
        url: input.endpoint.url,
        body: serializedPayload,
        headers: {
          'Content-Type': 'application/json',
          'X-SkybridgeCX-Event': input.eventType,
          'X-SkybridgeCX-Signature': signature,
          'X-SkybridgeCX-Delivery-Id': delivery.id,
          'X-SkybridgeCX-Timestamp': timestampSeconds
        }
      });

      const responseBody = await readResponseBody(response);

      if (response.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            deliveredAt: new Date(),
            responseStatus: response.status,
            responseBody
          }
        });

        return {
          endpointId: input.endpoint.id,
          deliveryId: delivery.id,
          eventType: input.eventType,
          success: true,
          statusCode: response.status,
          responseBody
        };
      }

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          failedAt: new Date(),
          responseStatus: response.status,
          responseBody,
          attempts: {
            increment: 1
          }
        }
      });

      return {
        endpointId: input.endpoint.id,
        deliveryId: delivery.id,
        eventType: input.eventType,
        success: false,
        statusCode: response.status,
        responseBody
      };
    } catch (error: unknown) {
      const errorMessage = truncateResponseBody(toErrorMessage(error));

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          failedAt: new Date(),
          responseStatus: null,
          responseBody: errorMessage,
          attempts: {
            increment: 1
          }
        }
      });

      return {
        endpointId: input.endpoint.id,
        deliveryId: delivery.id,
        eventType: input.eventType,
        success: false,
        statusCode: null,
        responseBody: errorMessage
      };
    }
  } catch (error: unknown) {
    console.error('Failed to dispatch webhook to endpoint', {
      error,
      endpointId: input.endpoint.id,
      eventType: input.eventType
    });

    return {
      endpointId: input.endpoint.id,
      deliveryId: null,
      eventType: input.eventType,
      success: false,
      statusCode: null,
      responseBody: truncateResponseBody(toErrorMessage(error))
    };
  }
}

export async function dispatchWebhook(
  tenantId: string,
  eventType: string,
  payload: DispatchablePayload
): Promise<WebhookDispatchResult[]> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        isActive: true,
        events: {
          has: eventType
        }
      },
      select: {
        id: true,
        tenantId: true,
        url: true,
        secret: true,
        events: true,
        isActive: true
      }
    });

    if (endpoints.length === 0) {
      return [];
    }

    return Promise.all(
      endpoints.map((endpoint) =>
        dispatchWebhookToEndpoint({
          endpoint,
          eventType,
          payload
        })
      )
    );
  } catch (error: unknown) {
    console.error('Failed to dispatch webhooks', {
      error,
      tenantId,
      eventType
    });
    return [];
  }
}
