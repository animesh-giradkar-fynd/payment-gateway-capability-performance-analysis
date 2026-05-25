'use client';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import { MOP_GROUP_ORDER, MOP_GROUP_COLOR, type MopGroup } from '@/lib/normalizations';
import { stateKey, emptyBreakdown } from '@/lib/state-rollup';
import type { DashboardFilters } from '@/lib/filters';

type StateMop = {
  state: string;
  total: number;
  breakdown: Record<MopGroup, number>;
};
type RegionalData = {
  states: StateMop[];
  coverage: { total_orders: number; mapped: number };
};

// India states TopoJSON (loaded client-side from CDN).
const INDIA_TOPO =
  'https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson';

const NO_DATA_FILL = '#eef0f3';
const GRADIENT_LOW = '#eef1f4';
// Per-MOP heat accent (the gradient's dark end). MOP_GROUP_COLOR.COD is grey — too
// low-contrast for a choropleth — so COD gets a dedicated amber here.
const MAP_ACCENT: Record<MopGroup, string> = {
  ...MOP_GROUP_COLOR,
  COD: '#92400e',
};
// States below this many mapped orders render faded — too thin to read confidently.
const THIN_DATA = 40;
const fmtInt = new Intl.NumberFormat('en-IN');

/** Share (0-1) of a state's orders that used the given MOP group. */
function shareOf(s: StateMop, g: MopGroup): number {
  return s.total > 0 ? s.breakdown[g] / s.total : 0;
}

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

export function RegionalHeatmap() {
  const filters = useFilterStore((s) => s.filters);
  const { data: resp, error, isLoading } = useSWR<{ data: RegionalData | null }>(
    ['/api/regional', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const errMsg = error ? String((error as Error).message ?? error) : null;
  const data = resp?.data ?? null;
  const states = useMemo(() => data?.states ?? [], [data]);
  // Coverage = mapped India-state orders ÷ total orders in the slice. The unmapped
  // share is international shipments + orders with non-canonical state strings; both
  // are honest gaps a viewer should see.
  const coverage = data?.coverage ?? null;
  const coveragePct =
    coverage && coverage.total_orders > 0
      ? (coverage.mapped / coverage.total_orders) * 100
      : null;

  const [metric, setMetric] = useState<MopGroup>('COD');
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ s: StateMop; x: number; y: number } | null>(null);

  // Index states by normalized name for O(1) geography lookup.
  const byKey = useMemo(() => {
    const m = new Map<string, StateMop>();
    for (const s of states) m.set(stateKey(s.state), s);
    return m;
  }, [states]);

  // MOP groups with volume, largest first — these become the metric chips.
  const metricGroups = useMemo(() => {
    const totals = emptyBreakdown();
    for (const s of states) {
      for (const g of MOP_GROUP_ORDER) totals[g] += s.breakdown[g];
    }
    return MOP_GROUP_ORDER
      .filter((g) => g !== 'Other' && totals[g] > 0)
      .sort((a, b) => totals[b] - totals[a]);
  }, [states]);

  // Guard: if the chosen metric has no data, fall back to the largest available.
  const activeMetric: MopGroup =
    metricGroups.includes(metric) ? metric : (metricGroups[0] ?? 'COD');
  const accent = MAP_ACCENT[activeMetric];

  // Colour scale for the active metric — domain spans the observed min/max share.
  const { colorScale, scaleLo, scaleHi } = useMemo(() => {
    const shares = states.filter((s) => s.total >= THIN_DATA).map((s) => shareOf(s, activeMetric));
    const lo = shares.length ? Math.min(...shares) : 0;
    const hi = shares.length ? Math.max(...shares) : 1;
    return {
      colorScale: scaleLinear<string>()
        .domain([lo, hi <= lo ? lo + 0.01 : hi])
        .range([GRADIENT_LOW, accent])
        .clamp(true),
      scaleLo: Math.round(lo * 100),
      scaleHi: Math.round(hi * 100),
    };
  }, [states, activeMetric, accent]);

  // Detail strip target: the selected state, else the all-India aggregate.
  const detail = useMemo<{ label: string; total: number; breakdown: Record<MopGroup, number> } | null>(() => {
    if (states.length === 0) return null;
    if (selected) {
      const s = byKey.get(selected);
      if (s) return { label: s.state, total: s.total, breakdown: s.breakdown };
    }
    const agg = emptyBreakdown();
    let total = 0;
    for (const s of states) {
      for (const g of MOP_GROUP_ORDER) {
        agg[g] += s.breakdown[g];
        total += s.breakdown[g];
      }
    }
    return { label: 'All mapped orders — India', total, breakdown: agg };
  }, [states, selected, byKey]);

  const isEmpty = !isLoading && !errMsg && states.length === 0;

  // Detail-strip bars: groups with volume, largest first.
  const detailBars = detail
    ? MOP_GROUP_ORDER
        .map((g) => ({ group: g, count: detail.breakdown[g] }))
        .filter((d) => d.count > 0)
        .sort((a, b) => b.count - a.count)
    : [];
  const detailMax = detailBars.reduce((mx, d) => Math.max(mx, d.count), 0);

  return (
    <Panel
      title="Payment-method preference by state — India"
      loading={isLoading}
      error={errMsg}
    >
      {isEmpty ? (
        <div className="panel-empty">No geo-located orders in the selected window.</div>
      ) : (
        <>
          {/* Metric switcher — pick which payment method shades the map */}
          <div className="regional-mop-tabs">
            <span className="regional-tabs-label">Shade map by</span>
            {metricGroups.map((g) => (
              <button
                key={g}
                type="button"
                className={`chip ${g === activeMetric ? 'chip-active' : ''}`}
                onClick={() => setMetric(g)}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Legend — gradient scale for the active metric */}
          <div className="regional-legend">
            <span className="regional-scale-cap">{activeMetric} share of orders</span>
            <span className="regional-scale-label">{scaleLo}%</span>
            <span
              className="regional-scale-bar"
              style={{ background: `linear-gradient(90deg, ${GRADIENT_LOW}, ${accent})` }}
            />
            <span className="regional-scale-label">{scaleHi}%</span>
            <span className="regional-legend-hint">
              Click a state for its full payment-method split
            </span>
          </div>

          <div className="regional-map-wrap">
            <div style={{ width: '100%', height: 460 }}>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [82, 23], scale: 900 }}
                width={760}
                height={460}
                style={{ width: '100%', height: '100%' }}
              >
                <Geographies geography={INDIA_TOPO}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const rawName = (
                        geo.properties.ST_NM ??
                        geo.properties.st_nm ??
                        geo.properties.NAME_1 ??
                        geo.properties.name ??
                        ''
                      ) as string;
                      const key = stateKey(rawName);
                      const s = byKey.get(key);
                      const isSel = selected === key;
                      const fill = s ? (colorScale(shareOf(s, activeMetric)) as string) : NO_DATA_FILL;
                      // Thin-data states render faded so they don't read as confident.
                      const opacity = s && s.total < THIN_DATA ? 0.5 : 1;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          fillOpacity={opacity}
                          stroke={isSel ? '#0f172a' : '#ffffff'}
                          strokeWidth={isSel ? 1.6 : 0.5}
                          onMouseEnter={(e) => {
                            if (s) setHover({ s, x: e.clientX, y: e.clientY });
                          }}
                          onMouseMove={(e) => {
                            if (s) setHover({ s, x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHover(null)}
                          onClick={() => {
                            if (!s) return;
                            setSelected((prev) => (prev === key ? null : key));
                          }}
                          style={{
                            default: { outline: 'none' },
                            hover: { outline: 'none', cursor: s ? 'pointer' : 'default' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>
            </div>

            {hover ? (
              <div
                className="regional-tooltip"
                style={{ left: hover.x + 14, top: hover.y + 14 }}
              >
                <div className="regional-tooltip-title">{hover.s.state}</div>
                <div className="regional-tooltip-total">
                  {fmtInt.format(hover.s.total)} mapped orders
                  {hover.s.total < THIN_DATA ? ' · thin sample' : ''}
                </div>
                <div className="regional-tooltip-metric" style={{ color: accent }}>
                  {(shareOf(hover.s, activeMetric) * 100).toFixed(0)}% {activeMetric}
                </div>
                {MOP_GROUP_ORDER
                  .map((g) => ({ g, c: hover.s.breakdown[g] }))
                  .filter((d) => d.c > 0)
                  .sort((a, b) => b.c - a.c)
                  .slice(0, 3)
                  .map(({ g, c }) => (
                    <div key={g} className="regional-tooltip-row">
                      <span className="regional-swatch" style={{ background: MAP_ACCENT[g] }} />
                      <span>{g}</span>
                      <span className="regional-tooltip-pct">
                        {((c / hover.s.total) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>

          {/* Detail strip — selected state, or the all-India aggregate */}
          {detail ? (
            <div className="regional-detail">
              <div className="regional-detail-head">
                <span className="regional-detail-label">{detail.label}</span>
                <span className="regional-detail-total">
                  {fmtInt.format(detail.total)} orders
                </span>
                {selected ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setSelected(null)}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {detailBars.map(({ group, count }) => (
                <div key={group} className="regional-bar-row">
                  <span className="regional-bar-label">
                    <span
                      className="regional-swatch"
                      style={{ background: MAP_ACCENT[group] }}
                    />
                    {group}
                  </span>
                  <span className="regional-bar-track">
                    <span
                      className="regional-bar-fill"
                      style={{
                        width: detailMax > 0 ? `${(count / detailMax) * 100}%` : '0%',
                        background: MAP_ACCENT[group],
                      }}
                    />
                  </span>
                  <span className="regional-bar-value">
                    {fmtInt.format(count)}
                    <span className="regional-bar-pct">
                      {detail.total > 0 ? ` ${((count / detail.total) * 100).toFixed(1)}%` : ''}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="regional-note muted">
            Delivery state sourced from order shipments — India only.{' '}
            {coverage && coveragePct != null ? (
              <>
                Coverage: <strong>{coveragePct.toFixed(1)}%</strong>
                {' '}({fmtInt.format(coverage.mapped)} of {fmtInt.format(coverage.total_orders)} orders mapped to an Indian state; the rest are international or missing-state).
                {' '}
              </>
            ) : null}
            States under {THIN_DATA} orders are faded.
          </p>
        </>
      )}
    </Panel>
  );
}
