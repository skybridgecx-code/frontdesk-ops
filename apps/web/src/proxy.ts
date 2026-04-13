import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/privacy(.*)',
  '/terms(.*)'
]);

function nextWithPathHeader(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-skybridge-pathname', request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

const clerkMiddlewareHandler = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  return nextWithPathHeader(request);
});

function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="SkybridgeCX"'
    }
  });
}

function shouldProtectWithBasicAuth(pathname: string) {
  return (
    pathname === '/calls' ||
    pathname.startsWith('/calls/') ||
    pathname === '/prospects' ||
    pathname.startsWith('/prospects/')
  );
}

export async function proxy(request: NextRequest, event: import('next/server').NextFetchEvent) {
  if (process.env.CLERK_SECRET_KEY) {
    return clerkMiddlewareHandler(request, event);
  }

  const pathname = new URL(request.url).pathname;
  if (!shouldProtectWithBasicAuth(pathname)) {
    return nextWithPathHeader(request);
  }

  const required = process.env.FRONTDESK_REQUIRE_BASIC_AUTH === 'true';
  const expectedUser = process.env.FRONTDESK_BASIC_AUTH_USER;
  const expectedPass = process.env.FRONTDESK_BASIC_AUTH_PASS;

  if (!required) {
    return nextWithPathHeader(request);
  }

  if (!expectedUser || !expectedPass) {
    return new NextResponse('Basic auth is enabled but credentials are not configured', {
      status: 500
    });
  }

  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Basic ')) {
    return unauthorized();
  }

  try {
    const decoded = atob(auth.slice('Basic '.length));
    const separator = decoded.indexOf(':');
    const user = separator >= 0 ? decoded.slice(0, separator) : '';
    const pass = separator >= 0 ? decoded.slice(separator + 1) : '';

    if (!constantTimeEqual(user, expectedUser) || !constantTimeEqual(pass, expectedPass)) {
      return unauthorized();
    }

    return nextWithPathHeader(request);
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)']
};
