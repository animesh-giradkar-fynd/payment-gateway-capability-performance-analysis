import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SignInButton } from '@/components/SignInButton';
import { FyndLogo } from '@/components/FyndLogo';

/**
 * Sign-in page. Detects misconfigured OAuth server-side and shows an explicit
 * "configuration required" panel instead of letting the user click into a broken
 * Google redirect.
 *
 * Surfaces NextAuth's standard `?error=...` query params:
 *   - AccessDenied — `signIn` callback rejected the email (wrong domain)
 *   - Configuration — NextAuth detected bad provider config
 *   - OAuthSignin / OAuthCallback / Callback — Google rejected the request
 *   - other — fallback "sign-in failed"
 */
export default async function Home({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/dashboard');
  }

  const oauthConfigured =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  const errorMessage = mapError(searchParams.error);

  return (
    <main className="signin-page">
      <div className="signin-card">
        <div className="signin-logo">
          <FyndLogo size={56} />
        </div>

        <h1>Payments Capability</h1>
        <p className="signin-subtitle">Sign in with your @gofynd.com account.</p>

        {!oauthConfigured ? (
          <div className="signin-config-error">
            <strong>OAuth is not configured.</strong>
            <p>
              The dashboard can&rsquo;t complete sign-in until <code>GOOGLE_CLIENT_ID</code> and{' '}
              <code>GOOGLE_CLIENT_SECRET</code> are set
              {process.env.NEXTAUTH_URL?.includes('vercel.app')
                ? ' in the Vercel project environment variables.'
                : ' in .env.local (and the dev server restarted).'}
            </p>
            <p>
              Provision an OAuth 2.0 Web client in{' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                GCP Console &rarr; APIs &amp; Services &rarr; Credentials
              </a>
              . Add <em>both</em> redirect URIs so prod and local dev work:
            </p>
            <ul className="signin-redirect-list">
              <li>
                <span className="redirect-label">Production</span>
                <code>https://payments-capability-dashboard.vercel.app/api/auth/callback/google</code>
              </li>
              <li>
                <span className="redirect-label">Local dev</span>
                <code>http://localhost:3000/api/auth/callback/google</code>
              </li>
            </ul>
          </div>
        ) : (
          <>
            <SignInButton />
            {errorMessage ? <p className="signin-error">{errorMessage}</p> : null}
          </>
        )}

        <p className="signin-footer">Restricted to Fynd employees. Internal use only.</p>
      </div>
    </main>
  );
}

function mapError(code?: string): string | null {
  if (!code) return null;
  switch (code) {
    case 'AccessDenied':
      return 'This dashboard is restricted to @gofynd.com accounts. Try a different Google account.';
    case 'Configuration':
      return 'Authentication is misconfigured on the server. Contact the dashboard owner.';
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'Callback':
      return 'Google rejected the sign-in request. The OAuth client may be missing this redirect URI, or the client credentials are wrong.';
    case 'OAuthAccountNotLinked':
      return 'This Google account is already linked to a different identity. Sign in with the original account.';
    default:
      return `Sign-in failed (${code}). Try again or contact the dashboard owner.`;
  }
}
