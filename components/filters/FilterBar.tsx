'use client';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useFilterStore } from '@/lib/store/filters';
import { lastNDays } from '@/lib/filters';
import { displayMOPLabel } from '@/lib/mop';
import { useFilterUrlSync } from '@/components/filters/useFilterUrlSync';

// ---------- Types ----------

type Option<TId extends string | number = string | number> = {
  id: TId;
  label: string;
  sublabel?: string;
};

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

// ---------- Main FilterBar ----------

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
  const close = () => setOpen(null);

  // Outside-click + ESC handlers — applied once at the FilterBar level so each
  // MultiSelectChip doesn't need its own.
  const filterBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Transform raw API data → uniform Option[] shape per dimension
  const pgOpts: Option<number>[] = (options?.aggregators ?? []).map((a) => ({
    id: a.aggregator_id,
    label: a.aggregator_name,
  }));
  const mopOpts: Option<string>[] = (options?.payment_modes ?? []).map((m) => ({
    id: m.payment_mode,
    label: displayMOPLabel(m.payment_mode),
    sublabel: m.payment_mode,
  }));
  const profileOpts: Option<number>[] = (options?.merchant_profiles ?? []).map((p) => ({
    id: p.merchant_profile_id,
    label: p.profile_name,
  }));
  const sellerOpts: Option<number>[] = (options?.sellers ?? []).map((s) => ({
    id: s.seller_id,
    label: s.seller_name,
  }));
  const channelOpts: Option<string>[] = (options?.ordering_channels ?? []).map((c) => ({
    id: c.ordering_channel,
    label: c.ordering_channel,
  }));

  const activePg = filters.aggregatorIds?.length ?? 0;
  const activeMop = filters.paymentModes?.length ?? 0;
  const activeProfile = filters.merchantProfileIds?.length ?? 0;
  const activeSeller = filters.sellerIds?.length ?? 0;
  const activeChannel = filters.orderingChannel?.length ?? 0;
  const anyActive = activePg + activeMop + activeProfile + activeSeller + activeChannel > 0;

  return (
    <div className="filter-bar" ref={filterBarRef}>
      <div className="filter-row">
        {/* Date presets */}
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
          options={pgOpts}
          selectedIds={filters.aggregatorIds ?? []}
          onChange={(ids) => patch({ aggregatorIds: ids.length ? (ids as number[]) : undefined })}
          open={open === 'pg'}
          onToggle={() => toggle('pg')}
          disabled={optLoading || !options}
        />
        <MultiSelectChip
          label="MOP"
          allText="All MOPs"
          options={mopOpts}
          selectedIds={filters.paymentModes ?? []}
          onChange={(ids) => patch({ paymentModes: ids.length ? (ids as string[]) : undefined })}
          open={open === 'mop'}
          onToggle={() => toggle('mop')}
          disabled={optLoading || !options}
        />
        <MultiSelectChip
          label="Storefront"
          allText="All storefronts"
          options={profileOpts}
          selectedIds={filters.merchantProfileIds ?? []}
          onChange={(ids) =>
            patch({ merchantProfileIds: ids.length ? (ids as number[]) : undefined })
          }
          open={open === 'profile'}
          onToggle={() => toggle('profile')}
          disabled={optLoading || !options}
        />
        <MultiSelectChip
          label="FC Seller"
          allText="All sellers"
          options={sellerOpts}
          selectedIds={filters.sellerIds ?? []}
          onChange={(ids) => patch({ sellerIds: ids.length ? (ids as number[]) : undefined })}
          open={open === 'seller'}
          onToggle={() => toggle('seller')}
          disabled={optLoading || !options}
        />
        <MultiSelectChip
          label="Channel"
          allText="All channels"
          options={channelOpts}
          selectedIds={filters.orderingChannel ?? []}
          onChange={(ids) =>
            patch({ orderingChannel: ids.length ? (ids as string[]) : undefined })
          }
          open={open === 'channel'}
          onToggle={() => toggle('channel')}
          disabled={optLoading || !options}
        />

        {/* Country (locked to India for v0) */}
        <div className="filter-group">
          <span className="filter-label">Country</span>
          <span className="chip chip-locked">India</span>
        </div>

        {/* Compare toggle */}
        <div className="filter-group">
          <button
            type="button"
            className={`chip ${filters.compareToPreviousPeriod ? 'chip-active' : ''}`}
            onClick={() => patch({ compareToPreviousPeriod: !filters.compareToPreviousPeriod })}
            title="Show delta vs. the equal-length window immediately before this one"
          >
            {filters.compareToPreviousPeriod ? '✓ ' : ''}Compare
          </button>
        </div>

        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          {anyActive || filters.compareToPreviousPeriod ? (
            <button type="button" className="text-button" onClick={reset}>
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------- Reusable multi-select chip ----------

type ChipProps<TId extends string | number> = {
  label: string;
  allText: string;
  options: Option<TId>[];
  selectedIds: TId[];
  onChange: (next: TId[]) => void;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

const MAX_INLINE_CHIPS = 2; // show up to 2 inline chips, then "+N"
const SEARCH_THRESHOLD = 8; // show typeahead when there are > N options

function MultiSelectChip<TId extends string | number>({
  label,
  allText,
  options,
  selectedIds,
  onChange,
  open,
  onToggle,
  disabled,
}: ChipProps<TId>) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus the search input (or first checkbox) when the dropdown opens.
  useEffect(() => {
    if (open) {
      // small delay so the element exists in the DOM
      const t = setTimeout(() => searchInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    setQuery(''); // reset search when closed
  }, [open]);

  const selectedSet = new Set(selectedIds.map(String));
  const selectedOptions = options.filter((o) => selectedSet.has(String(o.id)));
  const selectedCount = selectedOptions.length;

  const showSearch = options.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const visibleOptions = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false),
      )
    : options;

  const toggleId = (id: TId) => {
    const next = new Set(selectedIds.map(String));
    if (next.has(String(id))) next.delete(String(id));
    else next.add(String(id));
    onChange(
      options.filter((o) => next.has(String(o.id))).map((o) => o.id) as TId[],
    );
  };

  const removeInline = (id: TId, e: React.MouseEvent) => {
    e.stopPropagation(); // don't trigger the chip's onToggle
    onChange(selectedIds.filter((x) => String(x) !== String(id)));
  };

  return (
    <div className="filter-group filter-group-msc">
      <span className="filter-label">{label}</span>
      <button
        type="button"
        className={`chip msc-trigger ${selectedCount > 0 ? 'chip-active' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selectedCount === 0 ? (
          <span>
            {allText} <span className="msc-caret">▾</span>
          </span>
        ) : (
          <span className="msc-inline-chips">
            {selectedOptions.slice(0, MAX_INLINE_CHIPS).map((o) => (
              <span key={String(o.id)} className="msc-inline-chip" title={o.label}>
                <span className="msc-inline-label">{o.label}</span>
                <span
                  className="msc-inline-x"
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${o.label}`}
                  onClick={(e) => removeInline(o.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(selectedIds.filter((x) => String(x) !== String(o.id)));
                    }
                  }}
                >
                  ×
                </span>
              </span>
            ))}
            {selectedCount > MAX_INLINE_CHIPS ? (
              <span className="msc-inline-overflow">+{selectedCount - MAX_INLINE_CHIPS}</span>
            ) : null}
            <span className="msc-caret">▾</span>
          </span>
        )}
      </button>

      {open ? (
        <div className="dropdown dropdown-animated" role="listbox">
          <div className="dropdown-header">
            <span>{label}</span>
            {selectedCount > 0 ? (
              <button type="button" className="text-button" onClick={() => onChange([])}>
                Clear
              </button>
            ) : null}
          </div>
          {showSearch ? (
            <div className="dropdown-search-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="dropdown-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label}`}
                autoComplete="off"
              />
            </div>
          ) : null}
          <div className="dropdown-list">
            {visibleOptions.length === 0 ? (
              <div className="dropdown-empty">No matches.</div>
            ) : (
              visibleOptions.map((o) => {
                const checked = selectedSet.has(String(o.id));
                return (
                  <label key={String(o.id)} className="dropdown-row">
                    <input type="checkbox" checked={checked} onChange={() => toggleId(o.id)} />
                    <span className="dropdown-row-label">
                      {o.label}
                      {o.sublabel ? <span className="muted"> ({o.sublabel})</span> : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {q && visibleOptions.length > 0 ? (
            <div className="dropdown-footer muted">
              Showing {visibleOptions.length} of {options.length}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
