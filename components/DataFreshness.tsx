'use client';
import useSWR from 'swr';

/**
 * Topbar freshness note. Daily-batch sync from BQ → this surfaces TWO numbers:
 *  - "Data current as of …" — `MAX(t.created_on)` from BQ, the honest upper bound on
 *    what the dashboard's slice covers. Lags wall clock by ~24h on the daily sync.
 *  - "Loaded …" — the page-load time, so a viewer knows the freshness reading
 *    itself is current.
 *
 * Replaces the previous label, which only showed page-load time and was easily
 * misread as "the data is from right now."
 */
type FreshnessResponse = { data: { latestTxnAt: string | null } };

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
    return j;
  });

const IST = 'Asia/Kolkata';

function fmtIST(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { ...opts, timeZone: IST });
}

export function DataFreshness() {
  const { data, error } = useSWR<FreshnessResponse>('/api/freshness', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15 * 60 * 1000,
  });

  const latest = data?.data?.latestTxnAt ?? null;
  const dataAsOf = fmtIST(latest, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const loaded = fmtIST(new Date().toISOString(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // While we wait, fall back to the page-load timestamp so the topbar isn't blank.
  const primary = error
    ? 'Freshness unavailable'
    : dataAsOf
      ? `Data as of ${dataAsOf} IST`
      : 'Loading freshness…';
  const secondary = loaded ? `loaded ${loaded} IST` : '';

  return (
    <div className="topbar-freshness" title="Data lags the daily BigQuery sync; ‘loaded’ is your page-load time.">
      <span className="topbar-freshness-dot" aria-hidden />
      <span>
        {primary}
        {secondary ? ` · ${secondary}` : ''}
      </span>
    </div>
  );
}
