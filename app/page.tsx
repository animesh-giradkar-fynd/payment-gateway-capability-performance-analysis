import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SignInForm } from '@/components/SignInForm';
import { FyndLogo } from '@/components/FyndLogo';

/**
 * Sign-in page. Static credentials provider (D009). If the env vars aren't set,
 * shows a clear "configuration required" panel instead of letting the form fail
 * silently.
 */
export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/dashboard');
  }

  const credsConfigured =
    !!process.env.DASHBOARD_USERNAME && !!process.env.DASHBOARD_PASSWORD;

  return (
    <main className="signin-page">
      <div className="signin-card">
        <div className="signin-logo">
          <FyndLogo size={56} />
        </div>

        <h1>Payments Capability</h1>
        <p className="signin-subtitle">Internal Fynd dashboard.</p>

        {!credsConfigured ? (
          <div className="signin-config-error">
            <strong>Credentials are not configured.</strong>
            <p>
              Set <code>DASHBOARD_USERNAME</code> and <code>DASHBOARD_PASSWORD</code> as
              environment variables on the server, then redeploy.
            </p>
          </div>
        ) : (
          <SignInForm />
        )}

        <p className="signin-footer">Restricted access. Internal use only.</p>
      </div>
    </main>
  );
}
