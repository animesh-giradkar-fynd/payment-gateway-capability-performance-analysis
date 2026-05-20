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
  merchant_profiles: { merchant_profile_id: number; profile_name: string; transaction_count: number }[];
  sellers: { seller_id: number; seller_name: string; transaction_count: number }[];
  ordering_channels: { ordering_channel: string; transaction_count: number }[];
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

type DropdownKey = 'pg' | 'mop' | 'profile' | 'seller' | 'channel' | null;

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

  const [open, setOpen] = useState<DropdownKey>(null);
  const toggle = (key: DropdownKey) => setOpen((prev) => (prev === key ? null : key));

  const activePg = filters.aggregatorIds?.length ?? 0;
  const activeMop = filters.paymentModes?.length ?? 0;
  const activeProfile = filters.merchantProfileIds?.length ?? 0;
  const activeSeller = filters.sellerIds?.length ?? 0;
  const activeChannel = filters.orderingChannel?.length ?? 0;
  const anyActive = activePg + activeMop + activeProfile + activeSeller + activeChannel > 0;

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

        <MultiSelectChip
          label="PG"
          allText="All PGs"
          countActive={activePg}
          open={open === 'pg'}
          onToggle={() => toggle('pg')}
          disabled={optLoading || !options}
          onClear={() => patch({ aggregatorIds: undefined })}
        >
          {options?.aggregators.map((a) => {
            const checked = filters.aggregatorIds?.includes(a.aggregator_id) ?? false;
            return (
              <CheckRow
                key={a.aggregator_id}
                checked={checked}
                onToggle={(next) => {
                  const cur = new Set(filters.aggregatorIds ?? []);
                  next ? cur.add(a.aggregator_id) : cur.delete(a.aggregator_id);
                  patch({ aggregatorIds: cur.size ? Array.from(cur) : undefined });
                }}
                label={a.aggregator_name}
              />
            );
          })}
        </MultiSelectChip>

        <MultiSelectChip
          label="MOP"
          allText="All MOPs"
          countActive={activeMop}
          open={open === 'mop'}
          onToggle={() => toggle('mop')}
          disabled={optLoading || !options}
          onClear={() => patch({ paymentModes: undefined })}
        >
          {options?.payment_modes.map((m) => {
            const checked = filters.paymentModes?.includes(m.payment_mode) ?? false;
            return (
              <CheckRow
                key={m.payment_mode}
                checked={checked}
                onToggle={(next) => {
                  const cur = new Set(filters.paymentModes ?? []);
                  next ? cur.add(m.payment_mode) : cur.delete(m.payment_mode);
                  patch({ paymentModes: cur.size ? Array.from(cur) : undefined });
                }}
                label={
                  <>
                    {displayMOPLabel(m.payment_mode)}{' '}
                    <span className="muted">({m.payment_mode})</span>
                  </>
                }
              />
            );
          })}
        </MultiSelectChip>

        <MultiSelectChip
          label="Storefront"
          allText="All storefronts"
          countActive={activeProfile}
          open={open === 'profile'}
          onToggle={() => toggle('profile')}
          disabled={optLoading || !options}
          onClear={() => patch({ merchantProfileIds: undefined })}
        >
          {options?.merchant_profiles.map((p) => {
            const checked = filters.merchantProfileIds?.includes(p.merchant_profile_id) ?? false;
            return (
              <CheckRow
                key={p.merchant_profile_id}
                checked={checked}
                onToggle={(next) => {
                  const cur = new Set(filters.merchantProfileIds ?? []);
                  next ? cur.add(p.merchant_profile_id) : cur.delete(p.merchant_profile_id);
                  patch({ merchantProfileIds: cur.size ? Array.from(cur) : undefined });
                }}
                label={p.profile_name}
              />
            );
          })}
        </MultiSelectChip>

        <MultiSelectChip
          label="FC Seller"
          allText="All sellers"
          countActive={activeSeller}
          open={open === 'seller'}
          onToggle={() => toggle('seller')}
          disabled={optLoading || !options}
          onClear={() => patch({ sellerIds: undefined })}
        >
          {options?.sellers.map((s) => {
            const checked = filters.sellerIds?.includes(s.seller_id) ?? false;
            return (
              <CheckRow
                key={s.seller_id}
                checked={checked}
                onToggle={(next) => {
                  const cur = new Set(filters.sellerIds ?? []);
                  next ? cur.add(s.seller_id) : cur.delete(s.seller_id);
                  patch({ sellerIds: cur.size ? Array.from(cur) : undefined });
                }}
                label={s.seller_name}
              />
            );
          })}
        </MultiSelectChip>

        <MultiSelectChip
          label="Channel"
          allText="All channels"
          countActive={activeChannel}
          open={open === 'channel'}
          onToggle={() => toggle('channel')}
          disabled={optLoading || !options}
          onClear={() => patch({ orderingChannel: undefined })}
        >
          {options?.ordering_channels.map((c) => {
            const checked = filters.orderingChannel?.includes(c.ordering_channel) ?? false;
            return (
              <CheckRow
                key={c.ordering_channel}
                checked={checked}
                onToggle={(next) => {
                  const cur = new Set(filters.orderingChannel ?? []);
                  next ? cur.add(c.ordering_channel) : cur.delete(c.ordering_channel);
                  patch({ orderingChannel: cur.size ? Array.from(cur) : undefined });
                }}
                label={c.ordering_channel}
              />
            );
          })}
        </MultiSelectChip>

        {/* Country (locked to India for v0) */}
        <div className="filter-group">
          <span className="filter-label">Country</span>
          <span className="chip chip-locked">India</span>
        </div>

        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          {anyActive ? (
            <button type="button" className="text-button" onClick={reset}>
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function MultiSelectChip({
  label,
  allText,
  countActive,
  open,
  onToggle,
  disabled,
  onClear,
  children,
}: {
  label: string;
  allText: string;
  countActive: number;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="filter-group" style={{ position: 'relative' }}>
      <span className="filter-label">{label}</span>
      <button
        type="button"
        className={`chip ${countActive > 0 ? 'chip-active' : ''}`}
        onClick={onToggle}
        disabled={disabled}
      >
        {countActive > 0 ? `${countActive} selected` : allText} ▾
      </button>
      {open ? (
        <div className="dropdown">
          <div className="dropdown-header">
            <span>{label}</span>
            {countActive > 0 ? (
              <button type="button" className="text-button" onClick={onClear}>
                Clear
              </button>
            ) : null}
          </div>
          <div className="dropdown-list">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: (next: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="dropdown-row">
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
