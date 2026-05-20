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
  const { data: response, error, isLoading } = useSWR<{ data: MetricsRow | null }>(
    ['/api/metrics', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const data = response?.data ?? null;
  const errMsg = error ? String((error as Error).message ?? error) : null;

  return (
    <div className="metric-cards">
      <Panel title="Transactions" loading={isLoading} error={errMsg}>
        <div className="metric-value">{data ? fmtInt.format(data.transaction_volume) : '—'}</div>
        <div className="metric-sub">In the current slice</div>
      </Panel>

      <Panel title="Success rate" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtPct(data?.success_rate_pct ?? null)}</div>
        <div className="metric-sub">
          {data ? `${fmtInt.format(data.successful_count)} successful` : '—'}
        </div>
      </Panel>

      <Panel title="Failure rate" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtPct(data?.failure_rate_pct ?? null)}</div>
        <div className="metric-sub">
          {data ? `${fmtInt.format(data.failed_count)} failed` : '—'}
        </div>
      </Panel>

      <Panel title="Avg ticket" loading={isLoading} error={errMsg}>
        <div className="metric-value">{fmtRupees(data?.avg_ticket_size ?? null)}</div>
        <div className="metric-sub">Successful txns only · INR slice</div>
      </Panel>
    </div>
  );
}
