'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { useFilterStore } from '@/lib/store/filters';
import { lastNDays } from '@/lib/filters';
import { displayMOPLabel } from '@/lib/mop';
import { useFilterUrlSync } from '@/components/filters/useFilterUrlSync';

type FilterOptions = {
  aggregators: { aggregator_id: number; aggregator_name: string; transaction_count: number }[];
  payment_modes: { payment_mode: string; transaction_count: number }[];
};

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
    return j;
  });

const DATE_PRESETS = [
  { label: 'Today', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export function FilterBar() {
  useFilterUrlSync();

  const filters = useFilterStore((s) => s.filters);
  const patch = useFilterStore((s) => s.patch);
  const reset = useFilterStore((s) => s.reset);

  const { data: optResponse, isLoading: optLoading } = useSWR<{ data: FilterOptions }>(
    '/api/filter-options',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 60 * 1000 },
  );
  const options = optResponse?.data;

  const [pgOpen, setPgOpen] = useState(false);
  const [mopOpen, setMopOpen] = useState(false);

  const activePgCount = filters.aggregatorIds?.length ?? 0;
  const activeMopCount = filters.paymentModes?.length ?? 0;

  return (
    <div className="filter-bar">
      <div className="filter-row">
        {/* Date range presets */}
        <div className="filter-group">
          <span className="filter-label">Date</span>
          {DATE_PRESETS.map((preset) => {
            const range = lastNDays(preset.days);
            const isActive =
              filters.dateRange.from === range.from && filters.dateRange.to === range.to;
            return (
              <button
                key={preset.label}
                type="button"
                className={`chip ${isActive ? 'chip-active' : ''}`}
                onClick={() => patch({ dateRange: range })}
              >
                {preset.label}
              </button>
            );
          })}
          <div className="custom-range">
            <input
              type="date"
              value={filters.dateRange.from}
              onChange={(e) =>
                patch({ dateRange: { from: e.target.value, to: filters.dateRange.to } })
              }
              max={filters.dateRange.to}
              className="date-input"
              aria-label="From date"
            />
            <span className="muted">→</span>
            <input
              type="date"
              value={filters.dateRange.to}
              onChange={(e) =>
                patch({ dateRange: { from: filters.dateRange.from, to: e.target.value } })
              }
              min={filters.dateRange.from}
              className="date-input"
              aria-label="To date"
            />
          </div>
        </div>

        {/* PG multi-select */}
        <div className="filter-group" style={{ position: 'relative' }}>
          <span className="filter-label">PG</span>
          <button
            type="button"
            className={`chip ${activePgCount > 0 ? 'chip-active' : ''}`}
            onClick={() => {
              setPgOpen((v) => !v);
              setMopOpen(false);
            }}
            disabled={optLoading || !options}
          >
            {activePgCount > 0 ? `${activePgCount} selected` : 'All PGs'} ▾
          </button>
          {pgOpen && options ? (
            <div className="dropdown">
              <div className="dropdown-header">
                <span>Payment gateways</span>
                {activePgCount > 0 ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => patch({ aggregatorIds: undefined })}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="dropdown-list">
                {options.aggregators.map((a) => {
                  const checked = filters.aggregatorIds?.includes(a.aggregator_id) ?? false;
                  return (
                    <label key={a.aggregator_id} className="dropdown-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = new Set(filters.aggregatorIds ?? []);
                          if (e.target.checked) current.add(a.aggregator_id);
                          else current.delete(a.aggregator_id);
                          patch({
                            aggregatorIds: current.size > 0 ? Array.from(current) : undefined,
                          });
                        }}
                      />
                      <span>{a.aggregator_name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* MOP multi-select */}
        <div className="filter-group" style={{ position: 'relative' }}>
          <span className="filter-label">MOP</span>
          <button
            type="button"
            className={`chip ${activeMopCount > 0 ? 'chip-active' : ''}`}
            onClick={() => {
              setMopOpen((v) => !v);
              setPgOpen(false);
            }}
            disabled={optLoading || !options}
          >
            {activeMopCount > 0 ? `${activeMopCount} selected` : 'All MOPs'} ▾
          </button>
          {mopOpen && options ? (
            <div className="dropdown">
              <div className="dropdown-header">
                <span>Payment methods</span>
                {activeMopCount > 0 ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => patch({ paymentModes: undefined })}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="dropdown-list">
                {options.payment_modes.map((m) => {
                  const checked = filters.paymentModes?.includes(m.payment_mode) ?? false;
                  return (
                    <label key={m.payment_mode} className="dropdown-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = new Set(filters.paymentModes ?? []);
                          if (e.target.checked) current.add(m.payment_mode);
                          else current.delete(m.payment_mode);
                          patch({
                            paymentModes: current.size > 0 ? Array.from(current) : undefined,
                          });
                        }}
                      />
                      <span>
                        {displayMOPLabel(m.payment_mode)}{' '}
                        <span className="muted">({m.payment_mode})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Country (locked to India for v0) */}
        <div className="filter-group">
          <span className="filter-label">Country</span>
          <span className="chip chip-locked">India</span>
        </div>

        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <button type="button" className="text-button" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
