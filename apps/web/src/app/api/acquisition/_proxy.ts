import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';

type ProxyRequestInput = {
  request: NextRequest;
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  forwardQuery?: boolean;
  body?: unknown;
};

async function readProxyResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function proxyAcquisitionRequest({
  request,
  path,
  method = 'GET',
  forwardQuery = false,
  body
}: ProxyRequestInput) {
  const base = getApiBaseUrl();
  const pathname = path.startsWith('/') ? path : `/${path}`;
  const query = forwardQuery ? new URL(request.url).searchParams.toString() : '';
  const target = `${base}${pathname}${query ? `?${query}` : ''}`;

  const headers = await getInternalApiHeaders();
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  try {
    const response = await fetch(target, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store'
    });
    const data = await readProxyResponse(response);
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to reach acquisition API' }, { status: 502 });
  }
}
