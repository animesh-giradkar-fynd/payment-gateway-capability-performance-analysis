'use client';
import useSWR from 'swr';
import type { CapabilitiesData, OrchestrationRow } from '@/lib/capabilities';

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
    return j;
  });

const STATUS_BADGE: Record<OrchestrationRow['status'], string> = {
  live: 'badge-live',
  beta: 'badge-beta',
  planned: 'badge-planned',
};

export function OrchestrationPanel() {
  const { data: resp, error, isLoading } = useSWR<{ data: CapabilitiesData }>(
    '/api/capability-matrix',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const rows = resp?.data?.orchestration?.rows ?? [];
  const errMsg = error ? String((error as Error).message ?? error) : null;

  return (
    <section className="orchestration-section">
      <div className="orchestration-header">
        <h2>Fynd Orchestration</h2>
        <p className="muted">What Fynd unlocks across the gateways above</p>
      </div>

      {isLoading ? (
        <div className="panel-loading" style={{ padding: 16 }}>Loading…</div>
      ) : errMsg ? (
        <div className="panel-error" style={{ padding: 16 }}>{errMsg}</div>
      ) : (
        <ul className="orchestration-list">
          {rows.map((r) => (
            <li key={r.id} className="orchestration-row">
              <div className="orchestration-row-head">
                <span className="orchestration-name">{r.label}</span>
                <span className={`status-badge ${STATUS_BADGE[r.status]}`}>
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </span>
              </div>
              <p className="orchestration-desc">{r.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
