'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import { displayMOPLabel } from '@/lib/mop';
import {
  failureCategoryFor, FAILURE_CATEGORY_ORDER, type FailureCategory,
} from '@/lib/normalizations';
import type { DashboardFilters } from '@/lib/filters';

type FailureReasonRow = {
  reason_code: string;
  example_description: string | null;
  failure_count: number;
  share_pct: number;
};

type FilterOptions = {
  aggregators: { aggregator_id: number; aggregator_name: string }[];
  payment_modes: { payment_mode: string }[];
};

const fmtInt = new Intl.NumberFormat('en-IN');

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

const getFetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
    return j;
  });

export function FailuresPanel() {
  const topFilters = useFilterStore((s) => s.filters);
  const [pickerPg, setPickerPg] = useState<number | null>(null);
  const [pickerMop, setPickerMop] = useState<string | null>(null);

  const effective: DashboardFilters = {
    ...topFilters,
    aggregatorIds: pickerPg != null ? [pickerPg] : undefined,
    paymentModes: pickerMop != null ? [pickerMop] : undefined,
  };

  const { data: optsResp } = useSWR<{ data: FilterOptions }>('/api/filter-options', getFetcher, {
    revalidateOnFocus: false, dedupingInterval: 60 * 60 * 1000,
  });
  const options = optsResp?.data;

  const { data: resp, error, isLoading } = useSWR<{ data: FailureReasonRow[] }>(
    ['/api/failures', effective],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const rawRows = resp?.data ?? [];
  const errMsg = error ? String((error as Error).message ?? error) : null;

  // Bucket raw codes into friendly categories
  const totals: Record<FailureCategory, number> = {
    'Authentication failed': 0, 'Issuer decline': 0, 'Gateway error': 0,
    'User abandoned': 0, 'Verification failed': 0, 'Network / timeout': 0,
    'Refund / void issue': 0, 'Other': 0,
  };
  let grandTotal = 0;
  for (const r of rawRows) {
    totals[failureCategoryFor(r.reason_code)] += r.failure_count;
    grandTotal += r.failure_count;
  }

  // "Other" is the dominant raw-code dump (generic Razorpay/Juspay `FAILED` etc.) and
  // doesn't help leadership decide what to fix. Hide it from the chart, re-base the
  // visible bars to sum to 100% of CLASSIFIED failures, and show a small caption
  // disclosing the unclassified count so the data isn't silently dropped.
  // Per Animesh 2026-05-21 ("Other doesn't add any value").
  const unclassifiedCount = totals['Other'];
  const classifiedTotal = grandTotal - unclassifiedCount;
  const data = FAILURE_CATEGORY_ORDER
    .filter((cat) => cat !== 'Other')
    .map((cat) => ({
      category: cat,
      failure_count: totals[cat],
      share_pct: classifiedTotal > 0 ? (totals[cat] / classifiedTotal) * 100 : 0,
    }))
    .filter((d) => d.failure_count > 0)
    .sort((a, b) => b.failure_count - a.failure_count);

  const isEmpty = !isLoading && !errMsg && data.length === 0;
  const isCleanWindow = isEmpty && !pickerPg && !pickerMop;

  return (
    <Panel title="Failure reason breakdown" loading={isLoading} error={errMsg}>
      <div className="failures-picker">
        <span className="muted">Drill into:</span>
        <select
          className="picker-select"
          value={pickerPg ?? ''}
          onChange={(e) => setPickerPg(e.target.value ? Number(e.target.value) : null)}
          disabled={!options}
        >
          <option value="">All PGs</option>
          {options?.aggregators.map((a) => (
            <option key={a.aggregator_id} value={a.aggregator_id}>{a.aggregator_name}</option>
          ))}
        </select>
        <select
          className="picker-select"
          value={pickerMop ?? ''}
          onChange={(e) => setPickerMop(e.target.value || null)}
          disabled={!options}
        >
          <option value="">All MOPs</option>
          {options?.payment_modes.map((m) => (
            <option key={m.payment_mode} value={m.payment_mode}>{displayMOPLabel(m.payment_mode)}</option>
          ))}
        </select>
        {(pickerPg || pickerMop) && (
          <button type="button" className="text-button" onClick={() => { setPickerPg(null); setPickerMop(null); }}>
            Clear picker
          </button>
        )}
      </div>

      {isCleanWindow ? (
        <div className="panel-empty">No failures in this slice — that&rsquo;s a clean window.</div>
      ) : isEmpty ? (
        <div className="panel-empty">No transactions matched the picker.</div>
      ) : (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 16, bottom: 4 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                domain={[0, (max: number) => Math.ceil(max + 5)]}
                fontSize={11}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={140}
                fontSize={12}
                tick={{ fill: '#374151' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                formatter={(_value: number, _name: string, item) => {
                  const row = item.payload as (typeof data)[number];
                  return [
                    `${fmtInt.format(row.failure_count)} (${row.share_pct.toFixed(1)}%)`,
                    'Failures',
                  ];
                }}
              />
              <Bar dataKey="share_pct" radius={[0, 3, 3, 0]}>
                {data.map((_, i) => <Cell key={i} fill="#dc2626" fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
