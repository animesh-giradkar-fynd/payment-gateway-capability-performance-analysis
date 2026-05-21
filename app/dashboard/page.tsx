import { Suspense } from 'react';
import { headers } from 'next/headers';
import { MetricCards } from '@/components/panels/MetricCards';
import { GatewayMix } from '@/components/panels/GatewayMix';
import { MopMix } from '@/components/panels/MopMix';
import { FailuresPanel } from '@/components/panels/FailuresPanel';
import { RefundPosture } from '@/components/panels/RefundPosture';
import { GatewayLeaderboard } from '@/components/panels/GatewayLeaderboard';
import { GeographicPanel } from '@/components/panels/GeographicPanel';
import { CapabilityMatrix } from '@/components/matrix/CapabilityMatrix';
import { OrchestrationPanel } from '@/components/matrix/OrchestrationPanel';
import { FilterBar } from '@/components/filters/FilterBar';
import { FyndLogo } from '@/components/FyndLogo';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  // middleware.ts authenticated the request and forwarded the user via x-auth-user.
  // Falls back to 'guest' if the header is missing (only happens when env vars
  // aren't set, which middleware surfaces via x-auth-warning).
  const user = headers().get('x-auth-user') ?? 'guest';
  const authWarning = headers().get('x-auth-warning');

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="topbar-brand">
          <FyndLogo size={28} />
          <div>
            <h1>Payments Capability</h1>
            <span className="subtitle">Ecosystem health · 24h refresh</span>
          </div>
        </div>
        <div className="user-menu">
          <span className="user-email">Signed in as {user}</span>
        </div>
      </header>

      {authWarning ? (
        <div className="auth-warning">
          ⚠ {authWarning} — anyone can reach this page until you configure them.
        </div>
      ) : null}

      <Suspense fallback={<div className="filter-bar-skeleton">Loading filters…</div>}>
        <FilterBar />
      </Suspense>

      <section className="metric-row">
        <MetricCards />
      </section>

      <section className="metric-row">
        <GatewayLeaderboard />
      </section>

      <section className="panel-grid-2">
        <GatewayMix />
        <MopMix />
      </section>

      <section className="panel-grid-2">
        <FailuresPanel />
        <RefundPosture />
      </section>

      <section className="metric-row">
        <GeographicPanel />
      </section>

      <CapabilityMatrix />

      <OrchestrationPanel />

      <section className="upcoming">
        <h2>Coming next</h2>
        <ul>
          <li>State-level India heatmap (swap <code>GeographicPanel</code> for <code>react-simple-maps</code> once region data source confirmed — PRD Q3)</li>
          <li>Populate <code>data/capabilities.json</code> with per-PG capability research + the roadmap PG list</li>
          <li>Novus design system swap (mechanical with the <code>--nov-*</code> tokens already in place)</li>
        </ul>
      </section>
    </main>
  );
}
