'use client';
import useSWR from 'swr';
import type { CapabilitiesData, CellState } from '@/lib/capabilities';

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
    return j;
  });

const STATE_LABEL: Record<CellState, string> = {
  live: 'Live',
  beta: 'Beta',
  available: 'Available',
  'not-offered': 'Not offered',
};

const STATE_GLYPH: Record<CellState, string> = {
  live: '✓',
  beta: '◐',
  available: '○',
  'not-offered': '',
};

/**
 * Per-gateway header annotations — shown as a tiny grey caption under the PG name.
 * Use sparingly; only when a PG's role differs from "customer-facing payment gateway".
 * Currently empty (Cashfree subtitle dropped per Animesh 2026-05-21); keeping the map +
 * render branch in place so future annotations are a one-line add.
 */
const GATEWAY_SUBTITLE: Record<string, string> = {};

export function CapabilityMatrix() {
  const { data: resp, error, isLoading } = useSWR<{ data: CapabilitiesData }>(
    '/api/capability-matrix',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  if (isLoading) {
    return (
      <section className="matrix-section">
        <div className="matrix-header">
          <h2>Capability matrix</h2>
        </div>
        <div className="panel-loading" style={{ padding: 32 }}>Loading…</div>
      </section>
    );
  }

  if (error || !resp?.data) {
    return (
      <section className="matrix-section">
        <div className="matrix-header">
          <h2>Capability matrix</h2>
        </div>
        <div className="panel-error" style={{ padding: 16 }}>
          Couldn&rsquo;t load capability matrix. {error ? String((error as Error).message) : ''}
        </div>
      </section>
    );
  }

  const data = resp.data;
  const gateways = Object.keys(data.gateways);
  const roadmap = Object.keys(data.roadmapGateways);

  return (
    <section className="matrix-section">
      <div className="matrix-header">
        <div>
          <h2>Capability matrix</h2>
          <p className="muted">Fynd&rsquo;s payment capabilities across integrated gateways</p>
        </div>
        <MatrixLegend />
      </div>

      {gateways.length === 0 ? (
        <div className="panel-empty" style={{ padding: 24 }}>
          No gateways configured. Add entries under <code>gateways</code> in{' '}
          <code>data/capabilities.json</code>.
        </div>
      ) : (
        <MatrixTable bands={data.bands} gateways={gateways} cellSource={data.gateways} />
      )}

      {roadmap.length > 0 ? (
        <div className="matrix-roadmap">
          <div className="matrix-roadmap-header">
            <span className="matrix-roadmap-pill">Roadmap</span>
            <span className="muted">Gateways Fynd plans to integrate</span>
          </div>
          <MatrixTable
            bands={data.bands}
            gateways={roadmap}
            cellSource={data.roadmapGateways}
            roadmap
          />
        </div>
      ) : null}

      <p className="matrix-footer muted">
        Cells default to &ldquo;Not offered&rdquo; until populated. Edit{' '}
        <code>data/capabilities.json</code> to flip cells to <code>live</code>,{' '}
        <code>beta</code>, or <code>available</code>.
      </p>
    </section>
  );
}

function MatrixTable({
  bands,
  gateways,
  cellSource,
  roadmap = false,
}: {
  bands: CapabilitiesData['bands'];
  gateways: string[];
  cellSource: Record<string, Record<string, CellState>>;
  roadmap?: boolean;
}) {
  return (
    <div className="matrix-scroll">
      <table className={`matrix-table ${roadmap ? 'matrix-table-roadmap' : ''}`}>
        <thead>
          <tr>
            <th className="matrix-row-head matrix-sticky-col">Capability</th>
            {gateways.map((g) => (
              <th key={g} className="matrix-col-head" title={g}>
                <span className="matrix-col-name">{g}</span>
                {GATEWAY_SUBTITLE[g] ? (
                  <span className="matrix-col-note">{GATEWAY_SUBTITLE[g]}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bands.map((band) => (
            <Band key={band.id} bandLabel={band.label} colCount={gateways.length + 1}>
              {band.rows.map((row) => (
                <tr key={row.id}>
                  <td className="matrix-row-label matrix-sticky-col" title={row.label}>
                    {row.label}
                  </td>
                  {gateways.map((g) => {
                    const state = (cellSource[g]?.[row.id] ?? 'not-offered') as CellState;
                    return (
                      <td
                        key={g}
                        className={`matrix-cell matrix-cell-${state}`}
                        title={`${g} · ${row.label} · ${STATE_LABEL[state]}`}
                      >
                        <span className="matrix-glyph">{STATE_GLYPH[state]}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Band>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixLegend() {
  const entries: { state: CellState; label: string }[] = [
    { state: 'live', label: 'Live' },
    { state: 'beta', label: 'Beta' },
    { state: 'available', label: 'Available' },
    { state: 'not-offered', label: 'Not offered' },
  ];
  return (
    <div className="matrix-legend">
      {entries.map((e) => (
        <span key={e.state} className="matrix-legend-item">
          <span className={`matrix-cell-inline matrix-cell-${e.state}`}>
            {STATE_GLYPH[e.state] || ' '}
          </span>
          <span>{e.label}</span>
        </span>
      ))}
    </div>
  );
}

function Band({
  bandLabel,
  colCount,
  children,
}: {
  bandLabel: string;
  colCount: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="matrix-band-row">
        <td colSpan={colCount} className="matrix-band-cell matrix-sticky-col">
          {bandLabel}
        </td>
      </tr>
      {children}
    </>
  );
}
