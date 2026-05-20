import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { MetricCards } from '@/components/panels/MetricCards';
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

      <section className="filter-bar-placeholder">
        <span>Filters: Last 30 days · India · all PGs · all MOPs</span>
        <span className="muted">Interactive filter bar lands in M2.</span>
      </section>

      <section className="metric-row">
        <MetricCards />
      </section>

      <section className="upcoming">
        <h2>Coming next (M2 / M3 / M4)</h2>
        <ul>
          <li>Interactive filter bar (date, PG, MOP, storefront, ordering channel)</li>
          <li>Gateway mix + MOP mix panels (Recharts)</li>
          <li>Failure reasons drill-down with independent picker</li>
          <li>Refund posture panel</li>
          <li>India regional heatmap</li>
          <li>Capability matrix + Fynd Orchestration panel</li>
        </ul>
      </section>
    </main>
  );
}
