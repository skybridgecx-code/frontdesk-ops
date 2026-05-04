import { createHmac } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP, isIPv4, isIPv6 } from 'node:net';
import { prisma } from '@frontdesk/db';

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY_CHARS = 1000;

/**
 * SECURITY (C3, 2026-04-27) — SSRF guard for tenant-supplied webhook URLs.
 * Tenants register arbitrary URLs in the dashboard and our dispatcher POSTs
 * to them and persists the response body (truncated, exposed in the UI).
 * Without this guard, a tenant can probe internal services and read banner
 * responses through the webhook delivery log (e.g. AWS instance metadata at
 * 169.254.169.254, or local databases on 127.0.0.1).
 */
class WebhookUrlRejectedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'WebhookUrlRejectedError';
  }
}

function isPrivateIPv4(address: string) {
  if (!isIPv4(address)) return false;
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return true; // refuse anything we can't parse
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local incl AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(address: string) {
  if (!isIPv6(address)) return false;
  const lower = address.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('ff')) return true; // multicast
  // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  const mappedMatch = lower.match(/^::ffff:([0-9.]+)$/);
  if (mappedMatch) return isPrivateIPv4(mappedMatch[1] ?? '');
  return false;
}

async function assertWebhookUrlIsSafe(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new WebhookUrlRejectedError('Invalid URL');
  }

  const allowHttp = process.env.NODE_ENV === 'development';
  if (parsed.protocol === 'https:') {
    // ok
  } else if (parsed.protocol === 'http:' && allowHttp) {
    // ok in dev only
  } else {
    throw new WebhookUrlRejectedError(`Unsupported URL scheme: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;
  if (!hostname) throw new WebhookUrlRejectedError('Missing hostname');

  // Reject suspicious hostname forms early. Node's URL parser will accept
  // things like `http://0` (interpreted as 0.0.0.0 by some resolvers) and
  // hex/octal IP encodings — block them outright.
  if (/^0+$/.test(hostname) || /^0x/i.test(hostname)) {
    throw new WebhookUrlRejectedError('Suspicious hostname form');
  }

  // Block obvious literal-IP requests
  if (isIP(hostname)) {
    if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
      throw new WebhookUrlRejectedError('Private/loopback IPs are not allowed');
    }
    return;
  }

  // Resolve and reject if any A/AAAA record points at private space.
  // SECURITY (C3 follow-up, 2026-04-27): TOCTOU is partially mitigated by
  // also disabling redirects (`redirect: 'error'` in postWithTimeout), and
  // by validating *every* address the resolver returns (not just the first).
  // Defeating this would require a DNS server that actively rotates between
  // public and private answers, which is an active-attacker scenario rather
  // than a casual abuse vector.
  type LookupAddressEntry = { address: string; family: number };
  let resolved: LookupAddressEntry[];
  try {
    resolved = await dnsLookup(hostname, { all: true });
  } catch {
    throw new WebhookUrlRejectedError('Hostname did not resolve');
  }

  if (!Array.isArray(resolved) || resolved.length === 0) {
    throw new WebhookUrlRejectedError('Hostname did not resolve');
  }

  for (const entry of resolved) {
    if (entry.family === 4 && isPrivateIPv4(entry.address)) {
      throw new WebhookUrlRejectedError('Hostname resolves to a private IP');
    }
    if (entry.family === 6 && isPrivateIPv6(entry.address)) {
      throw new WebhookUrlRejectedError('Hostname resolves to a private IP');
    }
  }
}

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
    const response = await fetch(input.url, {
      method: 'POST',
      headers: input.headers,
      body: input.body,
      signal: controller.signal,
      // SECURITY (C3 follow-up, 2026-04-27): never follow redirects to a
      // tenant-supplied URL. A 30x to a private/loopback URL would otherwise
      // re-introduce SSRF after we validated the original hostname.
      redirect: 'error'
    });
    return response;
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

  // SECURITY (C3, 2026-04-27): block SSRF before we issue the request.
  try {
    await assertWebhookUrlIsSafe(input.endpoint.url);
  } catch (error: unknown) {
    const reason = error instanceof WebhookUrlRejectedError
      ? error.message
      : 'Webhook URL rejected';
    return {
      endpointId: input.endpoint.id,
      deliveryId: null,
      eventType: input.eventType,
      success: false,
      statusCode: null,
      responseBody: reason
    };
  }

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
