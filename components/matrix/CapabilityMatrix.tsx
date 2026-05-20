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
        <div className="matrix-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="matrix-row-head matrix-sticky-col">Capability</th>
                {gateways.map((g) => (
                  <th key={g} className="matrix-col-head" title={g}>
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.bands.map((band) => (
                <Band key={band.id} bandLabel={band.label} colCount={gateways.length + 1}>
                  {band.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="matrix-row-label matrix-sticky-col" title={row.label}>
                        {row.label}
                      </td>
                      {gateways.map((g) => {
                        const state = (data.gateways[g]?.[row.id] ?? 'not-offered') as CellState;
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
      )}

      <p className="matrix-footer muted">
        Cells default to &ldquo;Not offered&rdquo; until populated. Edit{' '}
        <code>data/capabilities.json</code> to flip cells to <code>live</code>,{' '}
        <code>beta</code>, or <code>available</code>.
      </p>
    </section>
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
