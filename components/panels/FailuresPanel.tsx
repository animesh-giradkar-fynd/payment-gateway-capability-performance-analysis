'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import { displayMOPLabel } from '@/lib/mop';
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
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.message ?? `HTTP ${r.status}`);
  return json;
}

const getFetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
    return j;
  });

/**
 * Failure-reason drill-down panel.
 *
 * Per PRD F6: independent PG/MOP picker (NOT synced to top filter). Date range comes from
 * the top filter; PG and MOP come from this panel's own state. Default empty = all PGs / MOPs.
 */
export function FailuresPanel() {
  const topFilters = useFilterStore((s) => s.filters);

  // Independent picker state — local, not in the global store
  const [pickerPg, setPickerPg] = useState<number | null>(null);
  const [pickerMop, setPickerMop] = useState<string | null>(null);

  // Effective filters for this panel: top-filter date + own PG/MOP
  const effective: DashboardFilters = {
    ...topFilters,
    aggregatorIds: pickerPg != null ? [pickerPg] : undefined,
    paymentModes: pickerMop != null ? [pickerMop] : undefined,
  };

  const { data: optsResp } = useSWR<{ data: FilterOptions }>('/api/filter-options', getFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
  });
  const options = optsResp?.data;

  const { data: resp, error, isLoading } = useSWR<{ data: FailureReasonRow[] }>(
    ['/api/failures', effective],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const rows = resp?.data ?? [];
  const errMsg = error ? String((error as Error).message ?? error) : null;
  const isEmpty = !isLoading && !errMsg && rows.length === 0;
  const isCleanWindow = isEmpty && !pickerPg && !pickerMop;

  return (
    <Panel
      title="Failure reasons"
      loading={isLoading}
      error={errMsg}
    >
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
            <option key={a.aggregator_id} value={a.aggregator_id}>
              {a.aggregator_name}
            </option>
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
            <option key={m.payment_mode} value={m.payment_mode}>
              {displayMOPLabel(m.payment_mode)}
            </option>
          ))}
        </select>
        {(pickerPg || pickerMop) && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setPickerPg(null);
              setPickerMop(null);
            }}
          >
            Clear picker
          </button>
        )}
      </div>

      {isCleanWindow ? (
        <div className="panel-empty">No failures in this slice — that&rsquo;s a clean window.</div>
      ) : isEmpty ? (
        <div className="panel-empty">No transactions matched the picker.</div>
      ) : !isLoading && !errMsg ? (
        <ol className="failures-list">
          {rows.map((r, i) => (
            <li key={r.reason_code} className="failures-row">
              <span className="failures-rank">{i + 1}</span>
              <div className="failures-body">
                <div className="failures-reason">{r.reason_code}</div>
                {r.example_description ? (
                  <div className="failures-desc" title={r.example_description}>
                    {r.example_description}
                  </div>
                ) : null}
              </div>
              <div className="failures-counts">
                <div className="failures-count">{fmtInt.format(r.failure_count)}</div>
                <div className="failures-share">{r.share_pct.toFixed(1)}%</div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}
