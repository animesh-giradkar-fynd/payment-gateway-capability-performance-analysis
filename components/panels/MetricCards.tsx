'use client';
import useSWR from 'swr';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import type { DashboardFilters } from '@/lib/filters';

type MetricsRow = {
  transaction_volume: number;
  successful_count: number;
  failed_count: number;
  success_rate_pct: number | null;
  failure_rate_pct: number | null;
  avg_ticket_size: number | null;
};
type MetricsResponse = { current: MetricsRow; previous: MetricsRow | null };

const fmtInt = new Intl.NumberFormat('en-IN');
const fmtMoney = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmtPct = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)}%`);
const fmtRupees = (n: number | null) => (n == null ? '—' : `₹${fmtMoney.format(n)}`);

async function postFetcher([url, body]: [string, DashboardFilters]) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.message ?? `HTTP ${r.status}`);
  return json;
}

export function MetricCards() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: MetricsResponse }>(
    ['/api/metrics', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const current = resp?.data?.current ?? null;
  const previous = resp?.data?.previous ?? null;
  const errMsg = error ? String((error as Error).message ?? error) : null;

  return (
    <div className="metric-cards">
      <Panel title="Transactions" loading={isLoading} error={errMsg}>
        <div className="metric-value">{current ? fmtInt.format(current.transaction_volume) : '—'}</div>
        <Delta
          current={current?.transaction_volume ?? null}
          previous={previous?.transaction_volume ?? null}
          unit="count"
        />
      </Panel>

      <Panel title="Success rate" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtPct(current?.success_rate_pct ?? null)}</div>
        <Delta
          current={current?.success_rate_pct ?? null}
          previous={previous?.success_rate_pct ?? null}
          unit="pts"
          fallback={current ? `${fmtInt.format(current.successful_count)} successful` : '—'}
        />
      </Panel>

      <Panel title="Failure rate" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtPct(current?.failure_rate_pct ?? null)}</div>
        <Delta
          current={current?.failure_rate_pct ?? null}
          previous={previous?.failure_rate_pct ?? null}
          unit="pts"
          invertSentiment
          fallback={current ? `${fmtInt.format(current.failed_count)} failed` : '—'}
        />
      </Panel>

      <Panel title="Avg ticket" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtRupees(current?.avg_ticket_size ?? null)}</div>
        <Delta
          current={current?.avg_ticket_size ?? null}
          previous={previous?.avg_ticket_size ?? null}
          unit="rupees"
          fallback="Successful txns · INR slice"
        />
      </Panel>
    </div>
  );
}

/**
 * Delta — renders comparison arrow + value when `previous` is present. Falls back to
 * `fallback` text when comparison is off (most metric cards prefer a contextual sub-line
 * over an empty space).
 *
 * `invertSentiment`: for metrics where DOWN is good (failure rate), green-tint a decrease.
 */
function Delta({
  current,
  previous,
  unit,
  fallback,
  invertSentiment,
}: {
  current: number | null;
  previous: number | null;
  unit: 'count' | 'pts' | 'rupees';
  fallback?: string;
  invertSentiment?: boolean;
}) {
  if (previous == null || current == null) {
    return <div className="metric-sub">{fallback ?? ' '}</div>;
  }

  const diff = current - previous;
  if (diff === 0) {
    return <div className="metric-sub metric-delta neutral">— no change vs. previous period</div>;
  }

  const isUp = diff > 0;
  const goodDirection = invertSentiment ? !isUp : isUp;
  const arrow = isUp ? '↑' : '↓';
  const abs = Math.abs(diff);
  let formatted: string;
  if (unit === 'pts') formatted = `${abs.toFixed(1)} pts`;
  else if (unit === 'rupees') formatted = `₹${fmtMoney.format(abs)}`;
  else formatted = fmtInt.format(abs);

  return (
    <div className={`metric-sub metric-delta ${goodDirection ? 'good' : 'bad'}`}>
      {arrow} {formatted} vs. previous period
    </div>
  );
}
