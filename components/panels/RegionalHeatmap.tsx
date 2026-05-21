'use client';
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { Panel } from '@/components/ui/Panel';
import { useFilterStore } from '@/lib/store/filters';
import { aggregateByState } from '@/lib/pincode-to-state';
import type { DashboardFilters } from '@/lib/filters';

type RegionalResponse = {
  india_pincodes: Array<{ pincode: string; order_count: number }>;
  global_countries: Array<{ country_iso_code: string; country: string | null; order_count: number }>;
  coverage: { total_orders: number; with_pincode: number; with_country: number };
};

// TopoJSON sources (loaded client-side from CDN)
const INDIA_TOPO = 'https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson';
const WORLD_TOPO = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ISO 3166-1 alpha-2 → numeric code (only the countries we actually see data from + a few neighbors for context).
// world-atlas TopoJSON keys countries by numeric ISO code (string). Expand this map as more
// countries surface in data.
const ISO2_TO_NUMERIC: Record<string, string> = {
  IN: '356', MY: '458', US: '840', GB: '826', AE: '784', SA: '682', SG: '702',
  AU: '036', CA: '124', NZ: '554', BD: '050', LK: '144', NP: '524', PK: '586',
  DE: '276', FR: '250', JP: '392', KR: '410', CN: '156', ID: '360', TH: '764',
  PH: '608', VN: '704', ZA: '710', NG: '566', EG: '818', BR: '076', MX: '484',
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

export function RegionalHeatmap() {
  const filters = useFilterStore((s) => s.filters);
  const [view, setView] = useState<'india' | 'world'>('india');

  const { data: resp, error, isLoading } = useSWR<{ data: RegionalResponse | null }>(
    ['/api/regional', filters],
    postFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const errMsg = error ? String((error as Error).message ?? error) : null;
  const data = resp?.data ?? null;

  // Aggregate pincode → state for India view
  const stateCounts = useMemo(() => {
    if (!data?.india_pincodes) return new Map<string, number>();
    const rows = aggregateByState(data.india_pincodes);
    return new Map(rows.map((r) => [r.state.toLowerCase(), r.order_count]));
  }, [data]);

  // Index countries by numeric ISO for world view
  const countryCounts = useMemo(() => {
    if (!data?.global_countries) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const c of data.global_countries) {
      const numeric = ISO2_TO_NUMERIC[c.country_iso_code];
      if (numeric) m.set(numeric, c.order_count);
    }
    return m;
  }, [data]);

  // Color scale — log-ish for skewed distributions
  const maxCount = view === 'india'
    ? Math.max(0, ...stateCounts.values())
    : Math.max(0, ...countryCounts.values());
  const colorScale = scaleLinear<string>()
    .domain([0, Math.max(1, maxCount)])
    .range(['#f3f4f6', '#1d4ed8']);

  const coverage = data?.coverage;
  const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) : '0.0');

  return (
    <Panel
      title={view === 'india' ? 'Regional preference — India (states by pincode)' : 'Regional preference — Global (countries)'}
      loading={isLoading}
      error={errMsg}
    >
      <div className="regional-toggle">
        <button
          type="button"
          className={`chip ${view === 'india' ? 'chip-active' : ''}`}
          onClick={() => setView('india')}
        >
          India
        </button>
        <button
          type="button"
          className={`chip ${view === 'world' ? 'chip-active' : ''}`}
          onClick={() => setView('world')}
        >
          World
        </button>
        {coverage ? (
          <span className="regional-coverage muted">
            Coverage: {pct(view === 'india' ? coverage.with_pincode : coverage.with_country, coverage.total_orders)}%
            ({fmtInt.format(view === 'india' ? coverage.with_pincode : coverage.with_country)} of {fmtInt.format(coverage.total_orders)} orders carry {view === 'india' ? 'a pincode' : 'a country'})
          </span>
        ) : null}
      </div>

      {view === 'india' ? (
        <div style={{ width: '100%', height: 480 }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [82, 23], scale: 900 }}
            width={800}
            height={480}
            style={{ width: '100%', height: '100%' }}
          >
            <Geographies geography={INDIA_TOPO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const stateName = (
                    geo.properties.NAME_1 ??
                    geo.properties.st_nm ??
                    geo.properties.name ??
                    ''
                  ) as string;
                  const count = stateCounts.get(stateName.toLowerCase()) ?? 0;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={count > 0 ? (colorScale(count) as string) : '#f3f4f6'}
                      stroke="#fff"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', fill: '#fb923c', cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                    >
                      <title>{`${stateName}: ${fmtInt.format(count)} orders`}</title>
                    </Geography>
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>
      ) : (
        <div style={{ width: '100%', height: 480 }}>
          <ComposableMap
            projection="geoEqualEarth"
            width={900}
            height={480}
            style={{ width: '100%', height: '100%' }}
          >
            <Geographies geography={WORLD_TOPO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const numeric = geo.id as string;
                  const name = (geo.properties.name ?? '') as string;
                  const count = countryCounts.get(numeric) ?? 0;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={count > 0 ? (colorScale(count) as string) : '#f3f4f6'}
                      stroke="#fff"
                      strokeWidth={0.3}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', fill: '#fb923c', cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                    >
                      <title>{`${name}: ${fmtInt.format(count)} orders`}</title>
                    </Geography>
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>
      )}

      {/* Top 5 list below the map for the dimension currently visible */}
      <div className="regional-list">
        <div className="regional-list-title">
          {view === 'india' ? 'Top 5 states' : 'Top 5 countries'}
        </div>
        <ul>
          {view === 'india'
            ? aggregateByState(data?.india_pincodes ?? []).slice(0, 5).map((r) => (
                <li key={r.state}>
                  <span>{r.state}</span>
                  <span>{fmtInt.format(r.order_count)}</span>
                </li>
              ))
            : (data?.global_countries ?? []).slice(0, 5).map((c) => (
                <li key={c.country_iso_code}>
                  <span>{c.country ?? c.country_iso_code}</span>
                  <span>{fmtInt.format(c.order_count)}</span>
                </li>
              ))}
        </ul>
      </div>

      <p className="regional-note muted">
        Coverage limited to orders that carry a deliverable address. Pincode→state mapping
        is approximate at state borders. Update <code>ISO2_TO_NUMERIC</code> in{' '}
        <code>RegionalHeatmap.tsx</code> as new countries appear in data.
      </p>
    </Panel>
  );
}
