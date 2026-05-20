'use client';
import useSWR from 'swr';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import { displayMOPLabel } from '@/lib/mop';
import type { DashboardFilters } from '@/lib/filters';

type MopMixRow = {
  payment_mode: string;
  normalized_mop_identifier: string | null;
  transaction_count: number;
  share_pct: number;
};

const fmtInt = new Intl.NumberFormat('en-IN');

const COLORS = ['#a3194f', '#0d8a5a', '#1e6abf', '#6d28d9', '#b45309', '#be185d', '#3730a3', '#15803d', '#7c2d12', '#0c4a6e'];

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

export function MopMix() {
  const filters = useFilterStore((s) => s.filters);
  const { data: response, error, isLoading } = useSWR<{ data: MopMixRow[] }>(
    ['/api/mop-mix', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const errMsg = error ? String((error as Error).message ?? error) : null;
  const rawRows = response?.data ?? [];

  // Roll up to one entry per payment_mode (collapse the normalized_mop_identifier breakdown
  // for the doughnut — that detail belongs in the tooltip / drill-down, not the top-level mix).
  const collapsed: Array<{ payment_mode: string; transaction_count: number; share_pct: number }> = [];
  const seen = new Map<string, number>();
  for (const r of rawRows) {
    const existing = seen.get(r.payment_mode);
    if (existing == null) {
      seen.set(r.payment_mode, collapsed.length);
      collapsed.push({ payment_mode: r.payment_mode, transaction_count: r.transaction_count, share_pct: r.share_pct });
    } else {
      collapsed[existing].transaction_count += r.transaction_count;
      collapsed[existing].share_pct += r.share_pct;
    }
  }
  collapsed.sort((a, b) => b.transaction_count - a.transaction_count);

  // Top 7 + "Other" rollup keeps the doughnut readable.
  const top = collapsed.slice(0, 7);
  const restTotal = collapsed.slice(7).reduce((s, r) => s + r.transaction_count, 0);
  const restShare = collapsed.slice(7).reduce((s, r) => s + r.share_pct, 0);
  const doughnutData =
    restTotal > 0
      ? [...top, { payment_mode: 'Other', transaction_count: restTotal, share_pct: restShare }]
      : top;

  const labeled = doughnutData.map((d) => ({
    ...d,
    label: d.payment_mode === 'Other' ? 'Other' : displayMOPLabel(d.payment_mode),
  }));

  const isEmpty = !isLoading && !errMsg && labeled.length === 0;

  return (
    <Panel title="Payment method mix" loading={isLoading} error={errMsg}>
      {isEmpty ? (
        <div className="panel-empty">No transactions in this slice.</div>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={labeled}
                dataKey="transaction_count"
                nameKey="label"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={1}
              >
                {labeled.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, item) => {
                  const share = (item.payload as (typeof labeled)[number]).share_pct;
                  return [`${fmtInt.format(value)} (${share.toFixed(1)}%)`, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconSize={10}
                layout="horizontal"
                verticalAlign="bottom"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
