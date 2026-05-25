'use client';
import useSWR from 'swr';
import { useFilterStore } from '@/lib/store/filters';
import { displayMOPLabel } from '@/lib/mop';

type FilterOptions = {
  aggregators: { aggregator_id: number; aggregator_name: string }[];
  payment_modes: { payment_mode: string }[];
  merchant_profiles: { merchant_profile_id: number; profile_name: string }[];
  sellers: { seller_id: number; seller_name: string }[];
  ordering_channels: { ordering_channel: string }[];
};

const getFetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
    return j;
  });

/** "Apr 26 → May 25" — terse range for the chrome strip. */
function fmtRange(fromYmd: string, toYmd: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  const f = new Date(fromYmd + 'T00:00:00Z').toLocaleDateString('en-IN', opts);
  const t = new Date(toYmd + 'T00:00:00Z').toLocaleDateString('en-IN', opts);
  return `${f} → ${t}`;
}

/**
 * FilterDigest — a thin strip below the FilterBar that always shows the active filter
 * state in plain language. Solves the audit's #12: a screenshot of any panel taken out
 * of context becomes meaningless because the panel itself doesn't echo what's filtered.
 *
 * Renders the date range (always) plus a comma-separated list of every dimension that
 * has a non-empty filter. Looks up IDs against /api/filter-options (SWR-cached 1h) so
 * the labels read e.g. "Razorpay" not "id=3".
 */
export function FilterDigest() {
  const filters = useFilterStore((s) => s.filters);
  const { data: optsResp } = useSWR<{ data: FilterOptions }>('/api/filter-options', getFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
  });
  const options = optsResp?.data;

  const parts: { label: string; values: string[] }[] = [];

  if (filters.aggregatorIds?.length && options) {
    const ids = new Set(filters.aggregatorIds);
    const values = options.aggregators
      .filter((a) => ids.has(a.aggregator_id))
      .map((a) => a.aggregator_name);
    if (values.length) parts.push({ label: 'Gateway', values });
  }
  if (filters.paymentModes?.length) {
    parts.push({ label: 'Payment method', values: filters.paymentModes.map(displayMOPLabel) });
  }
  if (filters.merchantProfileIds?.length && options) {
    const ids = new Set(filters.merchantProfileIds);
    const values = options.merchant_profiles
      .filter((m) => ids.has(m.merchant_profile_id))
      .map((m) => m.profile_name);
    if (values.length) parts.push({ label: 'Storefront', values });
  }
  if (filters.sellerIds?.length && options) {
    const ids = new Set(filters.sellerIds);
    const values = options.sellers
      .filter((s) => ids.has(s.seller_id))
      .map((s) => s.seller_name);
    if (values.length) parts.push({ label: 'Seller', values });
  }
  if (filters.orderingChannel?.length) {
    parts.push({ label: 'Surface', values: filters.orderingChannel });
  }

  const dateLabel = fmtRange(filters.dateRange.from, filters.dateRange.to);
  const hasFilters = parts.length > 0;

  return (
    <div className="filter-digest" role="note" aria-label="Active filters">
      <span className="filter-digest-window">
        <strong>Window:</strong> {dateLabel}
      </span>
      {hasFilters ? (
        <span className="filter-digest-active">
          <span className="filter-digest-sep" aria-hidden>·</span>
          <strong>Filters:</strong>{' '}
          {parts.map((p, i) => (
            <span key={p.label} className="filter-digest-part">
              {i > 0 ? <span className="filter-digest-comma">, </span> : null}
              <span className="filter-digest-label">{p.label}:</span>{' '}
              {/* Render up to 3 values inline; if more, suffix " +N more" so the strip
                  stays single-line on a typical viewport. */}
              {p.values.slice(0, 3).join(', ')}
              {p.values.length > 3 ? (
                <span className="filter-digest-more"> +{p.values.length - 3} more</span>
              ) : null}
            </span>
          ))}
        </span>
      ) : (
        <span className="filter-digest-clean">
          <span className="filter-digest-sep" aria-hidden>·</span>
          No filters · all gateways, methods, surfaces, sellers
        </span>
      )}
    </div>
  );
}
