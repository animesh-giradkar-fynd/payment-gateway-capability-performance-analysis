import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

/**
 * NextAuth configuration per D005.
 * - Google provider only.
 * - Domain restriction enforced in the `signIn` callback against ALLOWED_EMAIL_DOMAIN
 *   (default 'gofynd.com').
 * - No companyId-scoped RLS in v0; that lands with the fynd-console auth migration
 *   (architecture.md Appendix C).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN ?? 'gofynd.com').toLowerCase();
      const email = (profile?.email ?? user.email ?? '').toLowerCase();
      if (!email) return false;
      return email.endsWith(`@${allowedDomain}`);
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Expose stable user id to client-side session for any future audit needs.
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
