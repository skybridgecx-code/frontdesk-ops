import { NextRequest, NextResponse } from 'next/server';

type ProxyAdminRequestInput = {
  request: NextRequest;
  path: string;
  method?: 'GET' | 'POST' | 'PUT';
  forwardQuery?: boolean;
  body?: unknown;
};

function getApiUrl() {
  const base =
    process.env.FRONTDESK_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_FRONTDESK_API_BASE_URL;

  return base ? base.replace(/\/$/, '') : null;
}

function getAdminSecret() {
  const secret = process.env.FRONTDESK_INTERNAL_API_SECRET;
  return secret && secret.trim().length > 0 ? secret : null;
}

async function readProxyResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      raw: text
    };
  }
}

export async function proxyAdminRequest({
  request,
  path,
  method = 'GET',
  forwardQuery = false,
  body
}: ProxyAdminRequestInput) {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return NextResponse.json({ error: 'Admin API base URL not configured' }, { status: 503 });
  }

  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    return NextResponse.json({ error: 'Admin not configured' }, { status: 503 });
  }

  const pathname = path.startsWith('/') ? path : `/${path}`;
  const queryString = forwardQuery ? new URL(request.url).searchParams.toString() : '';
  const targetUrl = `${apiUrl}${pathname}${queryString ? `?${queryString}` : ''}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${adminSecret}`
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store'
    });

    const data = await readProxyResponse(response);
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach admin API' }, { status: 502 });
  }
}
