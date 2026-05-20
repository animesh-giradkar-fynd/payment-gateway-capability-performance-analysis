import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { MetricCards } from '@/components/panels/MetricCards';
import { GatewayMix } from '@/components/panels/GatewayMix';
import { MopMix } from '@/components/panels/MopMix';
import { FailuresPanel } from '@/components/panels/FailuresPanel';
import { RefundsPanel } from '@/components/panels/RefundsPanel';
import { CapabilityMatrix } from '@/components/matrix/CapabilityMatrix';
import { OrchestrationPanel } from '@/components/matrix/OrchestrationPanel';
import { FilterBar } from '@/components/filters/FilterBar';
import { SignOutButton } from '@/components/SignInButton';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/');
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <h1>Payments Capability</h1>
          <span className="subtitle">Ecosystem health · 24h refresh</span>
        </div>
        <div className="user-menu">
          <span className="user-email">{session.user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      {/*
        Suspense boundary is required because FilterBar uses useSearchParams (Next.js 14 rule
        for client components that read params in the App Router).
      */}
      <Suspense fallback={<div className="filter-bar-skeleton">Loading filters…</div>}>
        <FilterBar />
      </Suspense>

      <section className="metric-row">
        <MetricCards />
      </section>

      <section className="panel-grid-2">
        <GatewayMix />
        <MopMix />
      </section>

      <section className="panel-grid-2">
        <FailuresPanel />
        <RefundsPanel />
      </section>

      <CapabilityMatrix />

      <OrchestrationPanel />

      <section className="upcoming">
        <h2>Coming next</h2>
        <ul>
          <li>India regional heatmap (blocks on confirming the state data source — PRD Q3)</li>
          <li>Populate <code>data/capabilities.json</code> with per-PG capability research + roadmap PGs</li>
          <li>Novus design system swap (currently using placeholder tokens)</li>
        </ul>
      </section>
    </main>
  );
}
