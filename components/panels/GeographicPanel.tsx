'use client';
import useSWR from 'swr';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import type { DashboardFilters } from '@/lib/filters';

type SurfaceRow = {
  ordering_source: string;
  transaction_count: number;
  successful_count: number;
  total_amount: number | string;       // BigQuery NUMERIC may arrive as string
  successful_amount: number | string;
};

const fmtInt = new Intl.NumberFormat('en-IN');
const fmtMoney = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Friendly labels + per-surface accents. Anything not in the map falls through with
 *  the raw key (defensive — if Boltic ever introduces a new ordering_source we'll
 *  still render the row instead of crashing). */
const SURFACE_LABEL: Record<string, string> = {
  storefront: 'Online storefronts',
  store_os_pos: 'In-store POS',
  nexus: 'Headless / Nexus',
};
const SURFACE_HINT: Record<string, string> = {
  storefront: 'Customer-facing Fynd brand sites',
  store_os_pos: 'Store-OS terminals at physical outlets',
  nexus: 'API-driven checkouts via Fynd Nexus',
};
const SURFACE_COLOR: Record<string, string> = {
  storefront: '#1e6abf',
  store_os_pos: '#92400e',
  nexus: '#0d8a5a',
};

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

/**
 * Surface panel — three real surfaces (online storefront / in-store POS / headless
 * Nexus) with volume, share, SR, AOV, GMV side-by-side. Replaces the previous
 * top-10-storefronts bar chart whose dataset was 31% (unknown).
 *
 * A mini-table beats a chart here because the story is comparative: in-store POS has
 * smaller volume but the highest AOV and SR; Nexus has 6× lower AOV than the others.
 * Donut/bar shows only one dimension at a time.
 */
export function GeographicPanel() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: SurfaceRow[] }>(
    ['/api/geographic', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const errMsg = error ? String((error as Error).message ?? error) : null;
  const rawRows = resp?.data ?? [];

  // Coerce BIGNUMERIC strings → numbers and pre-compute the derived columns.
  const rows = rawRows.map((r) => {
    const total = Number(r.total_amount ?? 0);
    const successAmt = Number(r.successful_amount ?? 0);
    const successCount = r.successful_count;
    const txnCount = r.transaction_count;
    return {
      key: r.ordering_source,
      label: SURFACE_LABEL[r.ordering_source] ?? r.ordering_source,
      hint: SURFACE_HINT[r.ordering_source] ?? '',
      color: SURFACE_COLOR[r.ordering_source] ?? '#6b7280',
      transaction_count: txnCount,
      successful_count: successCount,
      sr_pct: txnCount > 0 ? (successCount / txnCount) * 100 : 0,
      aov: successCount > 0 ? successAmt / successCount : 0,
      successful_amount: successAmt,
      total_amount: total,
    };
  });

  const grandVolume = rows.reduce((s, r) => s + r.transaction_count, 0);
  const grandSuccess = rows.reduce((s, r) => s + r.successful_count, 0);
  const grandGmv = rows.reduce((s, r) => s + r.successful_amount, 0);
  const grandSr = grandVolume > 0 ? (grandSuccess / grandVolume) * 100 : 0;
  const grandAov = grandSuccess > 0 ? grandGmv / grandSuccess : 0;

  const isEmpty = !isLoading && !errMsg && rows.length === 0;

  return (
    <Panel
      title="Transactions by surface"
      subtitle="Where the order was placed — online storefronts, in-store POS, or headless API. Compared on volume, success rate, and ticket value."
      loading={isLoading}
      error={errMsg}
    >
      {isEmpty ? (
        <div className="panel-empty">No surface data in the selected window.</div>
      ) : (
        <div className="surface-table">
          <div className="surface-table-head">
            <div className="surface-th surface-th-name">Surface</div>
            <div className="surface-th surface-th-num">Transactions</div>
            <div className="surface-th surface-th-num">Success rate</div>
            <div className="surface-th surface-th-num">Avg ticket</div>
            <div className="surface-th surface-th-num">Successful GMV</div>
          </div>
          {rows.map((r) => {
            const sharePct = grandVolume > 0 ? (r.transaction_count / grandVolume) * 100 : 0;
            return (
              <div className="surface-row" key={r.key}>
                <div className="surface-td surface-td-name">
                  <div className="surface-td-label">
                    <span className="surface-swatch" style={{ background: r.color }} aria-hidden />
                    {r.label}
                  </div>
                  {r.hint ? <div className="surface-td-hint">{r.hint}</div> : null}
                  <div
                    className="surface-share-bar"
                    role="presentation"
                    style={{ width: `${sharePct}%`, background: r.color }}
                  />
                </div>
                <div className="surface-td surface-td-num">
                  <div className="surface-td-primary">{fmtInt.format(r.transaction_count)}</div>
                  <div className="surface-td-secondary">{sharePct.toFixed(1)}%</div>
                </div>
                <div className="surface-td surface-td-num">
                  <div className="surface-td-primary">{r.sr_pct.toFixed(1)}%</div>
                  <div className="surface-td-secondary">{fmtInt.format(r.successful_count)} ok</div>
                </div>
                <div className="surface-td surface-td-num">
                  <div className="surface-td-primary">₹{fmtMoney.format(r.aov)}</div>
                </div>
                <div className="surface-td surface-td-num">
                  <div className="surface-td-primary">₹{fmtMoney.format(r.successful_amount)}</div>
                </div>
              </div>
            );
          })}
          <div className="surface-row surface-row-total">
            <div className="surface-td surface-td-name">
              <div className="surface-td-label">Total</div>
            </div>
            <div className="surface-td surface-td-num">
              <div className="surface-td-primary">{fmtInt.format(grandVolume)}</div>
              <div className="surface-td-secondary">100%</div>
            </div>
            <div className="surface-td surface-td-num">
              <div className="surface-td-primary">{grandSr.toFixed(1)}%</div>
            </div>
            <div className="surface-td surface-td-num">
              <div className="surface-td-primary">₹{fmtMoney.format(grandAov)}</div>
            </div>
            <div className="surface-td surface-td-num">
              <div className="surface-td-primary">₹{fmtMoney.format(grandGmv)}</div>
            </div>
          </div>
          <p className="panel-note">
            Surface here is the order&rsquo;s <code>ordering_source</code> — Online storefronts
            are Fynd-hosted brand sites; In-store POS is Store-OS terminals; Nexus is the
            headless / API path. Excludes orders without a recognised source (~0.1%).
          </p>
        </div>
      )}
    </Panel>
  );
}
