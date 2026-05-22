'use client';
import useSWR from 'swr';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import type { DashboardFilters } from '@/lib/filters';

type MetricsRow = {
  transaction_volume: number;
  successful_count: number;
  failed_count: number;
  cancelled_count: number;
  success_rate_pct: number | null;
  failure_rate_pct: number | null;
  avg_transaction_value: number | null;
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
        <div className="metric-context">Payment attempts in the selected period</div>
      </Panel>

      <Panel title="Success rate" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtPct(current?.success_rate_pct ?? null)}</div>
        <Delta
          current={current?.success_rate_pct ?? null}
          previous={previous?.success_rate_pct ?? null}
          unit="pts"
        />
        {/* Defines the denominator — so it doesn't read as contradicting the
            gateway-decided success rate on the leaderboard below. */}
        <div className="metric-context">
          {current
            ? `${fmtInt.format(current.successful_count)} successful ÷ all transactions`
            : 'Successful ÷ all transactions'}
        </div>
      </Panel>

      <Panel title="Failure rate" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtPct(current?.failure_rate_pct ?? null)}</div>
        <Delta
          current={current?.failure_rate_pct ?? null}
          previous={previous?.failure_rate_pct ?? null}
          unit="pts"
          invertSentiment
        />
        {/* Composition is always shown — most of this rate is 2h-timeout cancels,
            not gateway declines, and a viewer must see that split. */}
        <div className="metric-context">
          {current
            ? `${fmtInt.format(current.failed_count)} gateway-declined · ${fmtInt.format(current.cancelled_count)} cancelled at 2h`
            : 'Gateway declines + 2h-timeout cancels'}
        </div>
      </Panel>

      <Panel title="Avg Transaction Value" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtRupees(current?.avg_transaction_value ?? null)}</div>
        <Delta
          current={current?.avg_transaction_value ?? null}
          previous={previous?.avg_transaction_value ?? null}
          unit="rupees"
          neutral
        />
        <div className="metric-context">Mean value · successful transactions</div>
      </Panel>
    </div>
  );
}

/**
 * Delta — renders the comparison line when `previous` is present (Compare is on).
 * Returns null otherwise; the persistent context line under it carries the
 * always-visible explainer.
 *
 * `invertSentiment`: for metrics where DOWN is good (failure rate).
 * `neutral`: for metrics with no inherent good direction (avg transaction value) — no red/green.
 */
function Delta({
  current,
  previous,
  unit,
  invertSentiment,
  neutral,
}: {
  current: number | null;
  previous: number | null;
  unit: 'count' | 'pts' | 'rupees';
  invertSentiment?: boolean;
  neutral?: boolean;
}) {
  if (previous == null || current == null) return null;

  const diff = current - previous;
  if (diff === 0) {
    return <div className="metric-sub metric-delta neutral">— no change vs. previous period</div>;
  }

  const isUp = diff > 0;
  const arrow = isUp ? '↑' : '↓';
  const abs = Math.abs(diff);
  let formatted: string;
  if (unit === 'pts') formatted = `${abs.toFixed(1)} pts`;
  else if (unit === 'rupees') formatted = `₹${fmtMoney.format(abs)}`;
  else formatted = fmtInt.format(abs);

  const sentiment = neutral
    ? 'neutral'
    : (invertSentiment ? !isUp : isUp)
      ? 'good'
      : 'bad';

  return (
    <div className={`metric-sub metric-delta ${sentiment}`}>
      {arrow} {formatted} vs. previous period
    </div>
  );
}
