'use client';
import useSWR from 'swr';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import type { DashboardFilters } from '@/lib/filters';

type GeographicRow = {
  label: string;
  transaction_count: number;
  successful_count: number;
  share_pct: number;
};

const fmtInt = new Intl.NumberFormat('en-IN');

const COLORS = [
  '#1e6abf', '#0d8a5a', '#6d28d9', '#b45309', '#a3194f',
  '#be185d', '#3730a3', '#15803d', '#7c2d12', '#0c4a6e',
];

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

export function GeographicPanel() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: GeographicRow[] }>(
    ['/api/geographic', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const rows = resp?.data ?? [];
  const errMsg = error ? String((error as Error).message ?? error) : null;
  const isEmpty = !isLoading && !errMsg && rows.length === 0;

  return (
    <Panel title="Top storefronts" loading={isLoading} error={errMsg}>
      {isEmpty ? (
        <div className="panel-empty">No transactions in this slice.</div>
      ) : (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <XAxis type="number" tickFormatter={(n) => fmtInt.format(n)} fontSize={11} />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                fontSize={11}
                tick={{ fill: '#374151' }}
              />
              <Tooltip
                formatter={(value: number, _name: string, item) => {
                  const share = (item.payload as GeographicRow).share_pct;
                  return [`${fmtInt.format(value)} (${share.toFixed(1)}%)`, 'Transactions'];
                }}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Bar dataKey="transaction_count" radius={[0, 3, 3, 0]}>
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
