'use client';
import { useEffect, useState } from 'react';

/**
 * Topbar freshness note. The dashboard runs on a daily batch sync (no live stream),
 * so the honest statement is the cadence plus the concrete time the viewer loaded
 * the page — replacing the old, vaguer "24h refresh" label.
 */
export function DataFreshness() {
  const [loaded, setLoaded] = useState<string>('');

  useEffect(() => {
    setLoaded(
      new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }, []);

  return (
    <div className="topbar-freshness">
      <span className="topbar-freshness-dot" aria-hidden />
      <span>Refreshed daily{loaded ? ` · loaded ${loaded}` : ''}</span>
    </div>
  );
}
