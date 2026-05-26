'use client';
import { useEffect } from 'react';

/**
 * Global error boundary for the App Router. Next.js wraps every route in this — if
 * any client component throws during render (or a Suspense boundary surfaces an
 * error), the user sees this page instead of a blank screen.
 *
 * Keeps the dashboard's visual chrome (Fynd brand framing, internal banner) so the
 * viewer knows they're still in the right place; offers a one-click retry + a link
 * back to the dashboard root.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in Vercel function logs + browser devtools. Keeps the message + digest
    // (Next's correlation ID for server-side errors) but doesn't include user data.
    console.error('[dashboard] runtime error:', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="dashboard">
      <div className="internal-banner" role="note">
        <strong>Internal · do not share externally.</strong>{' '}
        Contains Fynd payment volumes, success/failure rates, and competitor PG breakdowns.
      </div>

      <div className="error-page">
        <div className="error-card">
          <div className="error-card-icon" aria-hidden>⚠</div>
          <h1>Something went wrong loading this view.</h1>
          <p className="error-card-msg">
            The dashboard hit an unexpected error. The data is fine — only this render
            broke. Try reloading; if it keeps happening, ping the dashboard owner with
            the reference below.
          </p>
          {error.digest ? (
            <p className="error-card-ref">
              <span className="muted">Reference</span>{' '}
              <code>{error.digest}</code>
            </p>
          ) : null}
          <div className="error-card-actions">
            <button type="button" className="btn-primary" onClick={() => reset()}>
              Reload this view
            </button>
            <a href="/dashboard" className="btn-secondary">
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
