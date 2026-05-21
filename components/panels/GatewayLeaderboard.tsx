'use client';
import useSWR from 'swr';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import type { DashboardFilters } from '@/lib/filters';

type GatewayMixRow = {
  aggregator_name: string;
  transaction_count: number;
  successful_count: number;
  failed_count: number;
  share_pct: number;
};

const fmtInt = new Intl.NumberFormat('en-IN');

const COLORS = ['#1e6abf', '#0d8a5a', '#dc2626', '#6d28d9', '#b45309', '#be185d', '#3730a3', '#15803d', '#0c4a6e', '#9333ea'];

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
 * Gateway leaderboard — success rate × volume share, bubble size = volume.
 * Renders each PG as a single dot; the bigger and higher-right, the better.
 */
export function GatewayLeaderboard() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: GatewayMixRow[] }>(
    ['/api/gateway-mix', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const errMsg = error ? String((error as Error).message ?? error) : null;
  const rows = (resp?.data ?? [])
    .filter((r) => r.transaction_count > 0)
    .map((r) => {
      // Success rate is computed over TERMINAL-STATE rows only (success + failed),
      // matching the metrics-card definition. Pending rows (Razorpay `authorized`
      // awaiting capture, etc.) are not failures and shouldn't deflate the rate.
      const terminal = r.successful_count + r.failed_count;
      const pending_count = Math.max(0, r.transaction_count - terminal);
      return {
        ...r,
        pending_count,
        success_rate_pct: terminal > 0 ? (r.successful_count / terminal) * 100 : 0,
      };
    })
    .sort((a, b) => b.transaction_count - a.transaction_count)
    .slice(0, 10);

  const isEmpty = !isLoading && !errMsg && rows.length === 0;

  return (
    <Panel title="Gateway leaderboard — success rate × volume share" loading={isLoading} error={errMsg}>
      {isEmpty ? (
        <div className="panel-empty">No gateways in this slice.</div>
      ) : (
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 16, right: 16, bottom: 30, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis
                type="number"
                dataKey="share_pct"
                name="Volume share"
                domain={[0, (max: number) => Math.max(40, Math.ceil(max + 5))]}
                tickFormatter={(v) => `${Math.round(v)}`}
                fontSize={11}
                label={{ value: 'Volume share %', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                type="number"
                dataKey="success_rate_pct"
                name="Success rate"
                domain={[(min: number) => Math.max(0, Math.floor(min - 4)), 100]}
                tickFormatter={(v) => `${Math.round(v)}%`}
                fontSize={11}
                label={{ value: 'Success rate %', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#6b7280' }}
              />
              <ZAxis
                type="number"
                dataKey="transaction_count"
                range={[200, 2000]}
                name="Transactions"
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as typeof rows[number];
                  const terminal = r.successful_count + r.failed_count;
                  return (
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 220 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{r.aggregator_name}</div>
                      <div>Volume: {fmtInt.format(r.transaction_count)} ({r.share_pct.toFixed(1)}%)</div>
                      <div style={{ marginTop: 4 }}>
                        Success rate: <strong>{r.success_rate_pct.toFixed(1)}%</strong>
                        <span style={{ color: '#6b7280' }}> ({fmtInt.format(r.successful_count)} / {fmtInt.format(terminal)} terminal)</span>
                      </div>
                      <div style={{ color: '#6b7280' }}>Failed: {fmtInt.format(r.failed_count)}</div>
                      {r.pending_count > 0 ? (
                        <div style={{ color: '#6b7280' }}>
                          Pending: {fmtInt.format(r.pending_count)}
                          <span style={{ marginLeft: 4 }}>(authorized, awaiting capture)</span>
                        </div>
                      ) : null}
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
                payload={rows.map((r, i) => ({ value: r.aggregator_name, type: 'circle', color: COLORS[i % COLORS.length] }))}
              />
              <Scatter data={rows} fill="#1e6abf">
                {rows.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} stroke={COLORS[i % COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
