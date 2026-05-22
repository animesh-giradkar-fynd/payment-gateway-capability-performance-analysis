'use client';
import useSWR from 'swr';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import {
  refundMethodFor,
  REFUND_METHOD_ORDER,
  REFUND_METHOD_DESCRIPTION,
  type RefundMethod,
} from '@/lib/normalizations';
import type { DashboardFilters } from '@/lib/filters';

type RefundPostureRow = {
  payment_mode: string;
  refund_count: number;
  refund_amount: number | null;
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

/**
 * Refund posture — 4 KPI tiles by inferred refund method (per brief screenshot).
 * Method is derived from the underlying transaction's payment_mode via
 * normalizations.ts → refundMethodFor.
 */
export function RefundPosture() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: RefundPostureRow[] }>(
    ['/api/refund-posture', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const rows = resp?.data ?? [];
  const errMsg = error ? String((error as Error).message ?? error) : null;

  // Aggregate raw rows into the 4 method buckets
  const totalsByMethod: Record<RefundMethod, number> = {
    'Instant refund': 0, 'Source refund': 0, 'Store credit': 0, 'Cash / exchange': 0,
  };
  let grandTotal = 0;
  for (const r of rows) {
    const method = refundMethodFor(r.payment_mode);
    totalsByMethod[method] += r.refund_count;
    grandTotal += r.refund_count;
  }

  const pctOf = (method: RefundMethod) =>
    grandTotal > 0 ? (totalsByMethod[method] / grandTotal) * 100 : 0;

  const isEmpty = !isLoading && !errMsg && grandTotal === 0;

  return (
    <Panel
      title="Refund posture"
      subtitle="How refunds were issued — method inferred from how the customer originally paid."
      loading={isLoading}
      error={errMsg}
    >
      {isEmpty ? (
        <div className="panel-empty">No refunds in this slice.</div>
      ) : (
        <>
          <div className="refund-posture-grid">
            {REFUND_METHOD_ORDER.map((method) => {
              const pct = pctOf(method);
              const count = totalsByMethod[method];
              return (
                <div key={method} className="refund-posture-tile">
                  <div className="refund-posture-label">{method}</div>
                  <div className="refund-posture-value">{pct.toFixed(0)}%</div>
                  <div className="refund-posture-sub">
                    {REFUND_METHOD_DESCRIPTION[method]}
                    {grandTotal > 0 ? (
                      <span className="refund-posture-count"> · {fmtInt.format(count)} refunds</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="refund-posture-note">
            Refund method is inferred from how the customer originally paid — it isn&rsquo;t
            recorded separately. BNPL / EMI part-refunds often follow a manual process.
          </p>
        </>
      )}
    </Panel>
  );
}
