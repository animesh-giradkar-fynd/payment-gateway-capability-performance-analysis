'use client';
import useSWR from 'swr';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import type { DashboardFilters } from '@/lib/filters';

type RefundsResponse = {
  summary: {
    refund_count: number;
    total_refund_amount: number | null;
  };
  by_status: Array<{ status: string; count: number; share_pct: number }>;
  top_failure_reasons: Array<{
    reason_code: string;
    example_description: string | null;
    failure_count: number;
  }>;
};

const fmtInt = new Intl.NumberFormat('en-IN');
const fmtMoney = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmtRupees = (n: number | null) => (n == null ? '—' : `₹${fmtMoney.format(n)}`);

// Status semantic colors per design-language.md
const STATUS_COLOR: Record<string, string> = {
  complete: '#15803d',
  completed: '#15803d',
  paid: '#15803d',
  done: '#15803d',
  failed: '#b91c1c',
  pending: '#b45309',
  initiated: '#1e6abf',
};
const colorForStatus = (s: string) => STATUS_COLOR[s.toLowerCase()] ?? '#6b7280';

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

export function RefundsPanel() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: RefundsResponse | null }>(
    ['/api/refunds', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const data = resp?.data ?? null;
  const errMsg = error ? String((error as Error).message ?? error) : null;
  const isEmpty = !isLoading && !errMsg && (data?.summary?.refund_count ?? 0) === 0;

  return (
    <Panel title="Refund posture" loading={isLoading} error={errMsg}>
      {isEmpty ? (
        <div className="panel-empty">No refunds in this slice.</div>
      ) : data && !isLoading && !errMsg ? (
        <div className="refunds-grid">
          {/* Summary KPIs */}
          <div className="refunds-summary">
            <div className="refunds-kpi">
              <div className="refunds-kpi-label">Refunds</div>
              <div className="refunds-kpi-value">{fmtInt.format(data.summary.refund_count)}</div>
            </div>
            <div className="refunds-kpi">
              <div className="refunds-kpi-label">Total amount</div>
              <div className="refunds-kpi-value">{fmtRupees(data.summary.total_refund_amount)}</div>
            </div>
          </div>

          {/* Status distribution bar */}
          {data.by_status.length > 0 ? (
            <div className="refunds-section">
              <div className="refunds-section-title">Status distribution</div>
              <div style={{ width: '100%', height: 140 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={data.by_status}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <XAxis type="number" tickFormatter={(n) => fmtInt.format(n)} fontSize={11} />
                    <YAxis type="category" dataKey="status" width={90} fontSize={11} />
                    <Tooltip
                      formatter={(value: number, _name: string, item) => {
                        const share = (item.payload as { share_pct: number }).share_pct;
                        return [`${fmtInt.format(value)} (${share.toFixed(1)}%)`, 'Refunds'];
                      }}
                      cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {data.by_status.map((r, i) => (
                        <Cell key={i} fill={colorForStatus(r.status)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {/* Top failure reasons */}
          {data.top_failure_reasons.length > 0 ? (
            <div className="refunds-section">
              <div className="refunds-section-title">Top refund failure reasons</div>
              <ul className="refunds-failure-list">
                {data.top_failure_reasons.slice(0, 5).map((r) => (
                  <li key={r.reason_code} className="refunds-failure-row">
                    <span
                      className="refunds-failure-reason"
                      title={r.example_description ?? undefined}
                    >
                      {r.reason_code}
                    </span>
                    <span className="refunds-failure-count">{fmtInt.format(r.failure_count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Mode mix deferred — column source for OFFLINE/ONLINE/BOTH not yet verified in Zenith */}
          <div className="refunds-note muted">
            Refund mode mix (OFFLINE / ONLINE / BOTH) deferred — source column in Zenith pending verification.
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
