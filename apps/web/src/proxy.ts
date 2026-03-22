import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Frontdesk Ops"'
    }
  });
}

export function proxy(request: NextRequest) {
  const required = process.env.FRONTDESK_REQUIRE_BASIC_AUTH === 'true';
  const expectedUser = process.env.FRONTDESK_BASIC_AUTH_USER;
  const expectedPass = process.env.FRONTDESK_BASIC_AUTH_PASS;

  if (!required) {
    return NextResponse.next();
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

    if (user !== expectedUser || pass !== expectedPass) {
      return unauthorized();
    }

    return NextResponse.next();
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: ['/calls/:path*']
};
