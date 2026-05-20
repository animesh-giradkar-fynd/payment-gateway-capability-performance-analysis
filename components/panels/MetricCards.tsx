'use client';
import { useEffect, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { lastNDays } from '@/lib/filters';

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

export function MetricCards() {
  const [data, setData] = useState<MetricsRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRange: lastNDays(30) }),
      signal: ac.signal,
    })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(json.message ?? `HTTP ${r.status}`);
        }
        return json;
      })
      .then((j) => setData(j.data))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(String(e.message ?? e));
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, []);

  return (
    <div className="metric-cards">
      <Panel title="Transactions" loading={loading} error={error}>
        <div className="metric-value">{data ? fmtInt.format(data.transaction_volume) : '—'}</div>
        <div className="metric-sub">Last 30 days</div>
      </Panel>

      <Panel title="Success rate" loading={loading} error={error}>
        <div className="metric-value">{fmtPct(data?.success_rate_pct ?? null)}</div>
        <div className="metric-sub">
          {data ? `${fmtInt.format(data.successful_count)} successful` : '—'}
        </div>
      </Panel>

      <Panel title="Failure rate" loading={loading} error={error}>
        <div className="metric-value">{fmtPct(data?.failure_rate_pct ?? null)}</div>
        <div className="metric-sub">
          {data ? `${fmtInt.format(data.failed_count)} failed` : '—'}
        </div>
      </Panel>

      <Panel title="Avg ticket" loading={loading} error={error}>
        <div className="metric-value">{fmtRupees(data?.avg_ticket_size ?? null)}</div>
        <div className="metric-sub">Successful txns only · INR slice</div>
      </Panel>
    </div>
  );
}
