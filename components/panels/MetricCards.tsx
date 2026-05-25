'use client';
import useSWR from 'swr';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import { previousPeriodFor, type DashboardFilters } from '@/lib/filters';

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

/** "Mar 27 – Apr 25" — compact range label for the delta footer. Year omitted; same-year case. */
function fmtRange(fromYmd: string, toYmd: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  const f = new Date(fromYmd + 'T00:00:00Z').toLocaleDateString('en-IN', opts);
  const t = new Date(toYmd + 'T00:00:00Z').toLocaleDateString('en-IN', opts);
  return `${f} – ${t}`;
}

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

  // Concrete date label for the comparison line. Without this, "previous period"
  // is ambiguous — viewer can't tell if it's WoW, MoM, prior-quarter, or YoY.
  const prevRange = previousPeriodFor(filters).dateRange;
  const prevRangeLabel = fmtRange(prevRange.from, prevRange.to);

  // Uncategorized = transactions that didn't reach success / fail / 2h-cancel. They
  // exist (latest_status didn't map to a known unified_status) and the KPI denominator
  // includes them, so a viewer doing arithmetic on the subline must see them. ~5% in
  // production today — small but non-zero.
  const uncategorized = current
    ? Math.max(0, current.transaction_volume - current.successful_count - current.failed_count - current.cancelled_count)
    : 0;

  return (
    <div className="metric-cards">
      <Panel title="Transactions" loading={isLoading} error={errMsg}>
        <div className="metric-value">{current ? fmtInt.format(current.transaction_volume) : '—'}</div>
        <Delta
          current={current?.transaction_volume ?? null}
          previous={previous?.transaction_volume ?? null}
          unit="count"
          prevRangeLabel={prevRangeLabel}
        />
        <div className="metric-context">Payment attempts in the selected period</div>
      </Panel>

      <Panel title="Success rate" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtPct(current?.success_rate_pct ?? null)}</div>
        <Delta
          current={current?.success_rate_pct ?? null}
          previous={previous?.success_rate_pct ?? null}
          unit="pts"
          prevRangeLabel={prevRangeLabel}
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
          prevRangeLabel={prevRangeLabel}
        />
        {/* Composition is always shown — most of this rate is 2h-timeout cancels,
            not gateway declines, and a viewer must see that split. The uncategorized
            count is surfaced too so the line adds to total. */}
        <div className="metric-context">
          {current ? (
            <>
              {fmtInt.format(current.failed_count)} gateway-declined ·{' '}
              {fmtInt.format(current.cancelled_count)} cancelled at Fynd (2h timeout)
              {uncategorized > 0 ? ` · ${fmtInt.format(uncategorized)} uncategorized` : ''}
            </>
          ) : (
            'Gateway declines + Fynd 2h-timeout cancels + uncategorized'
          )}
        </div>
        {current ? (
          <div className="metric-context-foot">
            2h timeout = Fynd&rsquo;s internal cancel for transactions that never reach a
            terminal gateway status.
          </div>
        ) : null}
      </Panel>

      <Panel title="Avg Transaction Value" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtRupees(current?.avg_transaction_value ?? null)}</div>
        <Delta
          current={current?.avg_transaction_value ?? null}
          previous={previous?.avg_transaction_value ?? null}
          unit="rupees"
          neutral
          prevRangeLabel={prevRangeLabel}
        />
        <div className="metric-context">Mean value · successful transactions</div>
      </Panel>
    </div>
  );
}

/**
 * Delta — renders the comparison line whenever previous-period data is present.
 * Shows the explicit date range so "previous period" isn't ambiguous — a viewer
 * can tell at a glance whether the comparison is WoW, MoM, prior-quarter, or YoY.
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
  prevRangeLabel,
}: {
  current: number | null;
  previous: number | null;
  unit: 'count' | 'pts' | 'rupees';
  invertSentiment?: boolean;
  neutral?: boolean;
  prevRangeLabel: string;
}) {
  if (previous == null || current == null) return null;

  // Format the prior-period value so it can be shown as an explicit baseline —
  // gives the headline number a concrete reference point ("is 59.6% good?").
  const fmtVal = (v: number) =>
    unit === 'pts' ? `${v.toFixed(1)}%`
    : unit === 'rupees' ? `₹${fmtMoney.format(v)}`
    : fmtInt.format(v);

  const diff = current - previous;
  if (diff === 0) {
    return (
      <div className="metric-sub metric-delta neutral">
        — no change vs {prevRangeLabel} ({fmtVal(previous)})
      </div>
    );
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
      {arrow} {formatted} vs {prevRangeLabel} ({fmtVal(previous)})
    </div>
  );
}
