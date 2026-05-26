import Link from 'next/link';

/**
 * App-Router 404. Triggered by Next.js when no route matches. Kept visually
 * consistent with the global error page so a viewer who lands here still
 * recognises this as the same product.
 */
export default function NotFound() {
  return (
    <main className="dashboard">
      <div className="internal-banner" role="note">
        <strong>Internal · do not share externally.</strong>{' '}
        Contains Fynd payment volumes, success/failure rates, and competitor PG breakdowns.
      </div>

      <div className="error-page">
        <div className="error-card">
          <div className="error-card-icon" aria-hidden>404</div>
          <h1>That page doesn&rsquo;t exist.</h1>
          <p className="error-card-msg">
            The Payments Capability dashboard lives at <code>/dashboard</code> — try
            that, or use the button below.
          </p>
          <div className="error-card-actions">
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
