'use client';
import useSWR from 'swr';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import type { DashboardFilters } from '@/lib/filters';

type GatewayMixRow = {
  aggregator_name: string;
  transaction_count: number;
  successful_count: number;
  share_pct: number;
};

const fmtInt = new Intl.NumberFormat('en-IN');

// Categorical palette per design-language.md
const COLORS = ['#a3194f', '#0d8a5a', '#1e6abf', '#6d28d9', '#b45309', '#be185d', '#3730a3', '#15803d'];

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

export function GatewayMix() {
  const filters = useFilterStore((s) => s.filters);
  const { data: response, error, isLoading } = useSWR<{ data: GatewayMixRow[] }>(
    ['/api/gateway-mix', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const rows = response?.data ?? [];
  const errMsg = error ? String((error as Error).message ?? error) : null;
  const isEmpty = !isLoading && !errMsg && rows.length === 0;

  return (
    <Panel title="Gateway mix" loading={isLoading} error={errMsg}>
      {isEmpty ? (
        <div className="panel-empty">No transactions in this slice.</div>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={false} />
              <XAxis type="number" tickFormatter={(n) => fmtInt.format(n)} fontSize={11} />
              <YAxis
                type="category"
                dataKey="aggregator_name"
                width={110}
                fontSize={12}
                tick={{ fill: '#374151' }}
              />
              <Tooltip
                formatter={(value: number, name: string, item) => {
                  if (name === 'transaction_count') {
                    const share = (item.payload as GatewayMixRow).share_pct;
                    return [`${fmtInt.format(value)} (${share.toFixed(1)}%)`, 'Transactions'];
                  }
                  return [fmtInt.format(value), name];
                }}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Bar dataKey="transaction_count" radius={[0, 4, 4, 0]}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
