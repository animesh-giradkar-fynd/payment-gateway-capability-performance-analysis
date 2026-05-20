import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SignInButton } from '@/components/SignInButton';

export default async function Home({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/dashboard');
  }

  const domainError = searchParams.error === 'AccessDenied';

  return (
    <main className="signin-page">
      <div className="signin-card">
        <h1>Payments Capability</h1>
        <p>Sign in with your @gofynd.com account.</p>
        <SignInButton />
        {domainError ? (
          <p className="error">
            This dashboard is restricted to @gofynd.com accounts. Try a different Google account.
          </p>
        ) : null}
        <p className="footer">Restricted to Fynd employees. Internal use only.</p>
      </div>
    </main>
  );
}
