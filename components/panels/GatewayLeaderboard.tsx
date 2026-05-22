'use client';
import useSWR from 'swr';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import { gatewayColor, displayGatewayName } from '@/lib/gateways';
import type { DashboardFilters } from '@/lib/filters';

type GatewayMixRow = {
  aggregator_name: string;
  transaction_count: number;
  successful_count: number;
  failed_count: number;
  cancelled_count: number;
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
 * Gateway leaderboard — success rate × volume share, bubble size = volume.
 * Each PG is a single dot; bigger and higher-right is better.
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
      // Leaderboard SR is gateway-vs-gateway comparison: success / (success + failed).
      // The 2h-cancel bucket is Fynd's operational responsibility (capture delay,
      // webhook gaps) — not the gateway's decision — so excluding it keeps the
      // comparison fair across gateways with different capture models.
      //
      // (KPI card "Success rate" uses success/total — the Fynd-ecosystem view where
      // 2h cancels DO count because the customer experienced a failure.)
      const terminal = r.successful_count + r.failed_count;
      const uncategorized_count = Math.max(
        0,
        r.transaction_count - r.successful_count - r.failed_count - r.cancelled_count,
      );
      return {
        ...r,
        display_name: displayGatewayName(r.aggregator_name),
        color: gatewayColor(r.aggregator_name),
        uncategorized_count,
        success_rate_pct: terminal > 0 ? (r.successful_count / terminal) * 100 : 0,
      };
    })
    .sort((a, b) => b.transaction_count - a.transaction_count)
    .slice(0, 10);

  const isEmpty = !isLoading && !errMsg && rows.length === 0;

  return (
    <Panel
      title="Gateway leaderboard — success rate × volume share"
      subtitle="Each bubble is a gateway — bubble size = transaction volume; top-right = high success rate and high volume share."
      loading={isLoading}
      error={errMsg}
    >
      {isEmpty ? (
        <div className="panel-empty">No gateways in this slice.</div>
      ) : (
        <>
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
                  name="Gateway success rate"
                  domain={[(min: number) => Math.max(0, Math.floor(min - 4)), 100]}
                  tickFormatter={(v) => `${Math.round(v)}%`}
                  fontSize={11}
                  label={{ value: 'Gateway success rate %', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#6b7280' }}
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
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 260 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{r.display_name}</div>
                        <div>Volume: {fmtInt.format(r.transaction_count)} ({r.share_pct.toFixed(1)}%)</div>
                        <div style={{ marginTop: 4 }}>
                          Gateway success rate: <strong>{r.success_rate_pct.toFixed(1)}%</strong>
                          <span style={{ color: '#6b7280' }}> ({fmtInt.format(r.successful_count)} / {fmtInt.format(terminal)} gateway-decided)</span>
                        </div>
                        <div style={{ color: '#6b7280', marginTop: 4 }}>Failed (gateway declined): {fmtInt.format(r.failed_count)}</div>
                        {r.cancelled_count > 0 ? (
                          <div style={{ color: '#6b7280' }}>
                            Cancelled at Fynd (2h timeout): {fmtInt.format(r.cancelled_count)}
                            <span style={{ marginLeft: 4, fontSize: 10 }}>(not in success rate — Fynd-side)</span>
                          </div>
                        ) : null}
                        {r.uncategorized_count > 0 ? (
                          <div style={{ color: '#6b7280' }}>
                            Uncategorized: {fmtInt.format(r.uncategorized_count)}
                          </div>
                        ) : null}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
                  payload={rows.map((r) => ({ value: r.display_name, type: 'circle', color: r.color }))}
                />
                <Scatter data={rows} fill="#1e6abf">
                  {rows.map((r, i) => (
                    <Cell key={i} fill={r.color} fillOpacity={0.7} stroke={r.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="panel-note">
            Success rate here is <strong>gateway-decided</strong> — success ÷ (success + gateway
            declines). It excludes Fynd-side 2h-timeout cancels, so it reads higher than the
            overall <em>Success rate</em> card above (which counts every transaction).
          </p>
        </>
      )}
    </Panel>
  );
}
