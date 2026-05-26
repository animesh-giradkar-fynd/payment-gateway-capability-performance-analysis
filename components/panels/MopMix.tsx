'use client';
import useSWR from 'swr';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Label } from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import {
  mopGroupFor, MOP_GROUP_ORDER, MOP_GROUP_COLOR, type MopGroup,
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
 * MOP mix — share of transactions per normalized group (UPI / Cards / Wallets /
 * Net banking / BNPL-EMI / COD / Tap-to-pay / Other). Raw payment_mode codes
 * collapse via lib/normalizations.ts → mopGroupFor.
 */
export function MopMix() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: MopMixRow[] }>(
    ['/api/mop-mix', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const errMsg = error ? String((error as Error).message ?? error) : null;
  const rawRows = resp?.data ?? [];

  // Roll up raw payment_modes into the 7 named buckets
  const totals: Record<MopGroup, number> = {
    UPI: 0, Cards: 0, Wallets: 0, 'Net banking': 0,
    'BNPL/EMI': 0, COD: 0, 'Tap-to-pay': 0, Other: 0,
  };
  let total = 0;
  for (const r of rawRows) {
    totals[mopGroupFor(r.payment_mode)] += r.transaction_count;
    total += r.transaction_count;
  }

  const data = MOP_GROUP_ORDER
    .map((g) => ({
      name: g,
      transaction_count: totals[g],
      share_pct: total > 0 ? (totals[g] / total) * 100 : 0,
      fill: MOP_GROUP_COLOR[g],
    }))
    .filter((d) => d.transaction_count > 0);

  const isEmpty = !isLoading && !errMsg && data.length === 0;

  return (
    <Panel
      title="Online payment method mix"
      subtitle="Payment-method split across customer-facing payment gateways."
      loading={isLoading}
      error={errMsg}
    >
      {isEmpty ? (
        <div className="panel-empty">
          No transactions in this slice.{' '}
          <span className="panel-empty-hint">Try widening the date range or clearing a filter.</span>
        </div>
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
