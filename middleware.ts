import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * HTTP Basic Auth — every request goes through this. Reads DASHBOARD_USERNAME +
 * DASHBOARD_PASSWORD from env. Returns 401 with WWW-Authenticate if missing/wrong,
 * triggering the browser's native credential prompt. Forwards `x-auth-user` to the
 * downstream handler so pages can render the signed-in user.
 *
 * Why not NextAuth: this is a single-shared-credential internal demo. NextAuth's
 * CSRF tokens, JWT sessions, callbacks, and /api/auth/* routes are all overhead
 * we don't need. Middleware-based basic auth is ~30 lines + zero client state.
 *
 * Migration path: when per-user auth lands (fynd-console session or Google OAuth),
 * swap this file for the session check; the rest of the app already trusts the
 * middleware decision (Route Handlers don't re-check).
 */
export function middleware(req: NextRequest) {
  const expectedUser = process.env.DASHBOARD_USERNAME;
  const expectedPass = process.env.DASHBOARD_PASSWORD;

  // Local-dev bypass: when NODE_ENV is 'development' (i.e. `pnpm dev`, never prod),
  // skip basic auth. Lets developers iterate without re-entering the dialog every
  // hard refresh, and lets preview tooling inspect pages without credential-in-URL
  // gymnastics. Production deploys (NODE_ENV='production') always enforce auth.
  if (process.env.NODE_ENV === 'development') {
    const res = NextResponse.next();
    res.headers.set('x-auth-user', expectedUser ?? 'dev-bypass');
    return res;
  }

  // Misconfigured: allow through with a header so the page can warn — better than
  // silently 401'ing forever when the operator hasn't set the env vars yet.
  if (!expectedUser || !expectedPass) {
    const res = NextResponse.next();
    res.headers.set('x-auth-warning', 'DASHBOARD_USERNAME / DASHBOARD_PASSWORD not set');
    return res;
  }

  const header = req.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    const decoded = decodeBasic(header.slice('Basic '.length));
    if (decoded) {
      const [user, ...passParts] = decoded.split(':');
      const pass = passParts.join(':'); // password can contain colons
      if (user === expectedUser && pass === expectedPass) {
        const res = NextResponse.next();
        res.headers.set('x-auth-user', user);
        return res;
      }
    }
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Payments Capability Dashboard"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function decodeBasic(b64: string): string | null {
  try {
    // Edge runtime: atob is available, Buffer is not.
    return atob(b64);
  } catch {
    return null;
  }
}

/**
 * Apply to everything EXCEPT Next.js internals + static brand assets. Static files
 * served from public/ are still gated to avoid leaking anything; explicit exceptions
 * carved out for the logos so the 401 page can still reference them if needed later.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fynd-logo|google-icon).*)'],
};
