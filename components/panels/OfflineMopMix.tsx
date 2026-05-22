'use client';
import useSWR from 'swr';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Label } from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import {
  offlineMopGroupFor,
  OFFLINE_MOP_GROUP_ORDER,
  OFFLINE_MOP_GROUP_COLOR,
  type OfflineMopGroup,
} from '@/lib/normalizations';
import type { DashboardFilters } from '@/lib/filters';

type MopMixRow = {
  payment_mode: string;
  normalized_mop_identifier: string | null;
  transaction_count: number;
  share_pct: number;
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
 * Offline MOP mix — Fynd-managed offline payments only (COD, Cash at store, UPI at store).
 * Driven by /api/mop-mix-offline which runs the Fynd-only slice. Stays semantically separate
 * from the Online MopMix panel so leadership doesn't conflate PG-driven and operator-driven
 * volume.
 */
export function OfflineMopMix() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: MopMixRow[] }>(
    ['/api/mop-mix-offline', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const errMsg = error ? String((error as Error).message ?? error) : null;
  const rawRows = resp?.data ?? [];

  // Roll up raw payment_modes into the 4 offline buckets
  const totals: Record<OfflineMopGroup, number> = {
    COD: 0, 'Cash at store': 0, 'UPI at store': 0, Other: 0,
  };
  let total = 0;
  for (const r of rawRows) {
    totals[offlineMopGroupFor(r.payment_mode)] += r.transaction_count;
    total += r.transaction_count;
  }

  const data = OFFLINE_MOP_GROUP_ORDER
    .map((g) => ({
      name: g,
      transaction_count: totals[g],
      share_pct: total > 0 ? (totals[g] / total) * 100 : 0,
      fill: OFFLINE_MOP_GROUP_COLOR[g],
    }))
    .filter((d) => d.transaction_count > 0);

  const isEmpty = !isLoading && !errMsg && data.length === 0;

  return (
    <Panel
      title="Offline payment method mix (Fynd-managed)"
      subtitle="Cash on delivery, cash at store and UPI at store — operated by Fynd, not by a payment gateway."
      loading={isLoading}
      error={errMsg}
    >
      {isEmpty ? (
        <div className="panel-empty">No offline transactions in the selected window.</div>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="transaction_count"
                nameKey="name"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={1}
              >
                {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                <Label
                  content={(props) => {
                    const vb = props.viewBox as { cx: number; cy: number } | undefined;
                    if (!vb) return null;
                    return (
                      <g>
                        <text x={vb.cx} y={vb.cy - 6} textAnchor="middle" fontSize={20} fontWeight={700} fill="#0f172a">
                          {fmtInt.format(total)}
                        </text>
                        <text x={vb.cx} y={vb.cy + 13} textAnchor="middle" fontSize={11} fill="#6b7280">
                          transactions
                        </text>
                      </g>
                    );
                  }}
                />
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, item) => {
                  const share = (item.payload as (typeof data)[number]).share_pct;
                  return [`${fmtInt.format(value)} (${share.toFixed(1)}%)`, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconSize={10}
                layout="vertical"
                verticalAlign="middle"
                align="right"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
