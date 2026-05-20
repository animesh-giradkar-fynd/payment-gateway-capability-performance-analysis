import { timingSafeEqual } from 'node:crypto';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * NextAuth — static credentials provider (D005 revised to D009 for v0 demo).
 *
 * Why static creds (and not Google OAuth as originally planned in D005):
 *   - GCP Console access for provisioning an OAuth consent screen requires admin
 *     permissions in a Fynd-owned GCP project; that access wasn't reliably available
 *     for the demo timeline.
 *   - Static credentials require zero external provisioning — just two env vars on
 *     Vercel + local .env.local. Faster to ship the demo, deterministic to verify.
 *
 * Tradeoffs vs. Google OAuth:
 *   - Single shared password across all stakeholders; no per-user audit trail.
 *   - No @gofynd.com domain restriction — anyone with the password gets in. The
 *     password IS the access control. Rotate via `vercel env rm` + `vercel env add`.
 *   - Migration path back to Google OAuth (or fynd-console auth) is mechanical:
 *     swap the provider in this file; the rest of the app is provider-agnostic.
 *
 * Compare uses `crypto.timingSafeEqual` so brute-forcing the password can't measure
 * how many characters matched.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const expectedUser = process.env.DASHBOARD_USERNAME ?? '';
        const expectedPass = process.env.DASHBOARD_PASSWORD ?? '';
        if (!expectedUser || !expectedPass) {
          // Surface as a configuration issue rather than letting any pair through
          console.error(
            '[auth] DASHBOARD_USERNAME / DASHBOARD_PASSWORD not set — refusing all sign-ins',
          );
          return null;
        }
        const userOk = safeEqual(credentials.username ?? '', expectedUser);
        const passOk = safeEqual(credentials.password ?? '', expectedPass);
        if (userOk && passOk) {
          return {
            id: 'fynd-team',
            name: expectedUser,
            email: `${expectedUser}@fynd.internal`,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8, // 8 hours
  },
};
