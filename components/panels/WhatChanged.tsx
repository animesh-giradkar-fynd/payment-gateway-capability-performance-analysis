'use client';
import useSWR from 'swr';
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
  successful_gmv: number | string | null;
};
type MetricsResponse = { current: MetricsRow; previous: MetricsRow | null };

const fmtInt = new Intl.NumberFormat('en-IN');
const fmtMoney = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

async function postFetcher([url, body]: [string, DashboardFilters]) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
  return j;
}

type Change = {
  label: string;
  /** Percent change as a number; positive = up. */
  pctChange: number;
  /** Formatted "from → to" line for the secondary text. */
  fromTo: string;
  /** 'good' | 'bad' | 'neutral' — colour sentiment of the change. */
  sentiment: 'good' | 'bad' | 'neutral';
};

/**
 * WhatChanged — surfaces the 2 biggest absolute % movements between the current
 * slice and the previous-period slice. Picked from {volume, SR, FR, AOV, GMV}.
 *
 * Goal: give a stakeholder a 5-second read of what's notably different about
 * this period BEFORE they scroll. Pure derivation from data already fetched by
 * MetricCards (`/api/metrics`) — no new BQ call.
 *
 * Threshold: only renders changes ≥ 5% (or ≥ 2 pts for rates). Otherwise the
 * strip stays empty rather than reporting noise as signal.
 */
export function WhatChanged() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp } = useSWR<{ data: MetricsResponse }>(
    ['/api/metrics', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );
  const current = resp?.data?.current ?? null;
  const previous = resp?.data?.previous ?? null;
  if (!current || !previous) return null;

  const candidates: Change[] = [];

  // Volume
  if (previous.transaction_volume > 0) {
    const pct = ((current.transaction_volume - previous.transaction_volume) / previous.transaction_volume) * 100;
    if (Math.abs(pct) >= 5) {
      candidates.push({
        label: 'Transactions',
        pctChange: pct,
        fromTo: `${fmtInt.format(previous.transaction_volume)} → ${fmtInt.format(current.transaction_volume)}`,
        sentiment: pct > 0 ? 'good' : 'bad',
      });
    }
  }

  // Success rate (pts, not %)
  if (current.success_rate_pct != null && previous.success_rate_pct != null) {
    const pts = current.success_rate_pct - previous.success_rate_pct;
    if (Math.abs(pts) >= 2) {
      candidates.push({
        label: 'Success rate',
        pctChange: pts, // here pctChange = pts diff for sorting
        fromTo: `${previous.success_rate_pct.toFixed(1)}% → ${current.success_rate_pct.toFixed(1)}%`,
        sentiment: pts > 0 ? 'good' : 'bad',
      });
    }
  }

  // Failure rate (pts; UP is bad)
  if (current.failure_rate_pct != null && previous.failure_rate_pct != null) {
    const pts = current.failure_rate_pct - previous.failure_rate_pct;
    if (Math.abs(pts) >= 2) {
      candidates.push({
        label: 'Failure rate',
        pctChange: pts,
        fromTo: `${previous.failure_rate_pct.toFixed(1)}% → ${current.failure_rate_pct.toFixed(1)}%`,
        sentiment: pts < 0 ? 'good' : 'bad',
      });
    }
  }

  // AOV
  if (current.avg_transaction_value != null && previous.avg_transaction_value != null && previous.avg_transaction_value > 0) {
    const pct = ((current.avg_transaction_value - previous.avg_transaction_value) / previous.avg_transaction_value) * 100;
    if (Math.abs(pct) >= 5) {
      candidates.push({
        label: 'Avg ticket',
        pctChange: pct,
        fromTo: `₹${fmtMoney.format(previous.avg_transaction_value)} → ₹${fmtMoney.format(current.avg_transaction_value)}`,
        sentiment: 'neutral',
      });
    }
  }

  // GMV
  const curGmv = current.successful_gmv != null ? Number(current.successful_gmv) : null;
  const prevGmv = previous.successful_gmv != null ? Number(previous.successful_gmv) : null;
  if (curGmv != null && prevGmv != null && prevGmv > 0) {
    const pct = ((curGmv - prevGmv) / prevGmv) * 100;
    if (Math.abs(pct) >= 5) {
      candidates.push({
        label: 'Successful GMV',
        pctChange: pct,
        fromTo: `₹${fmtMoney.format(prevGmv)} → ₹${fmtMoney.format(curGmv)}`,
        sentiment: pct > 0 ? 'good' : 'bad',
      });
    }
  }

  // Pick the 2 biggest absolute movers.
  const top = candidates
    .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))
    .slice(0, 2);

  if (top.length === 0) return null;

  return (
    <div className="what-changed" role="note" aria-label="Notable changes vs previous period">
      <span className="what-changed-label">What changed:</span>
      {top.map((c) => {
        const arrow = c.pctChange > 0 ? '↑' : c.pctChange < 0 ? '↓' : '—';
        const isPts = c.label === 'Success rate' || c.label === 'Failure rate';
        const magnitude = isPts
          ? `${Math.abs(c.pctChange).toFixed(1)} pts`
          : `${Math.abs(c.pctChange).toFixed(0)}%`;
        return (
          <span key={c.label} className={`what-changed-item what-changed-${c.sentiment}`}>
            <strong>{c.label}</strong>{' '}
            <span className="what-changed-arrow">{arrow}</span>{' '}
            <span className="what-changed-magnitude">{magnitude}</span>
            <span className="what-changed-fromto"> ({c.fromTo})</span>
          </span>
        );
      })}
    </div>
  );
}
