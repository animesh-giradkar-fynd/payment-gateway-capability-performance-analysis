import { Suspense } from 'react';
import { MetricCards } from '@/components/panels/MetricCards';
import { GatewayMix } from '@/components/panels/GatewayMix';
import { MopMix } from '@/components/panels/MopMix';
import { OfflineMopMix } from '@/components/panels/OfflineMopMix';
import { FailuresPanel } from '@/components/panels/FailuresPanel';
import { RefundPosture } from '@/components/panels/RefundPosture';
import { GatewayLeaderboard } from '@/components/panels/GatewayLeaderboard';
import { GeographicPanel } from '@/components/panels/GeographicPanel';
import { RegionalHeatmap } from '@/components/panels/RegionalHeatmap';
import { CapabilityMatrix } from '@/components/matrix/CapabilityMatrix';
import { FilterBar } from '@/components/filters/FilterBar';
import { FyndLogo } from '@/components/FyndLogo';
import { DataFreshness } from '@/components/DataFreshness';
import { SectionNav } from '@/components/SectionNav';
import { FilterDigest } from '@/components/FilterDigest';
import { WhatChanged } from '@/components/panels/WhatChanged';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  return (
    <main className="dashboard">
      {/* Internal-only banner — the deploy URL is public, so the page itself has
          to declare its audience. Discourages casual external sharing. */}
      <div className="internal-banner" role="note">
        <strong>Internal · do not share externally.</strong>{' '}
        Contains Fynd payment volumes, success/failure rates, and competitor PG breakdowns.
      </div>

      <header className="topbar">
        <div className="topbar-brand">
          <FyndLogo size={36} iconOnly />
          <div className="topbar-divider" aria-hidden />
          <div className="topbar-title">
            <h1>Payments Capability</h1>
            <span className="subtitle">Ecosystem health · India</span>
          </div>
        </div>
        <DataFreshness />
      </header>

      <Suspense fallback={<div className="filter-bar-skeleton">Loading filters…</div>}>
        <FilterBar />
      </Suspense>
      <FilterDigest />

      <SectionNav />

      <section id="sec-kpis" className="metric-row dash-section">
        <WhatChanged />
        <MetricCards />
      </section>

      <section id="sec-gateways" className="metric-row dash-section">
        <GatewayLeaderboard />
      </section>

      <section id="sec-methods" className="panel-grid-2 dash-section">
        <GatewayMix />
        <MopMix />
      </section>

      <section className="metric-row dash-section">
        <OfflineMopMix />
      </section>

      <section id="sec-failures" className="panel-grid-2 dash-section">
        <FailuresPanel />
        <RefundPosture />
      </section>

      <section id="sec-regional" className="metric-row dash-section">
        <RegionalHeatmap />
      </section>

      <section id="sec-surface" className="metric-row dash-section">
        <GeographicPanel />
      </section>

      <div id="sec-capabilities" className="dash-section">
        <CapabilityMatrix />
      </div>
    </main>
  );
}
