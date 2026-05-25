import { NextResponse } from 'next/server';
import { getBQ } from '@/lib/bq/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Cache the freshness query for 15 minutes — the source is a daily batch sync, so
// hammering BQ from every page load adds cost without changing the answer.
export const revalidate = 15 * 60;

const PROJECT = process.env.BQ_PROJECT ?? 'fynd-jio-commerceml-prod';
const DATASET = process.env.BQ_DATASET ?? 'fynd_zenith_data';
const Z = `\`${PROJECT}.${DATASET}\``;

/**
 * Returns the most-recent `created_on` across active transactions — the honest
 * upper bound on what the dashboard's data reflects. Replaces the previous
 * "page-load time" framing on the topbar, which conflated "you opened this page"
 * with "the data is fresh as of now."
 *
 * Daily-batch sync means this will typically lag the current wall clock by 12-24
 * hours; surfacing the exact lag is the point.
 */
export async function GET() {
  try {
    const bq = getBQ();
    const location = process.env.BQ_LOCATION ?? 'US';
    const start = Date.now();

    const [rows] = await bq.query({
      query: `
        SELECT
          FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', MAX(created_on)) AS latest_txn_at
        FROM ${Z}.dbe_transaction
        WHERE is_active = TRUE
          AND DATE(created_on) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      `,
      location,
    });
    const duration = Date.now() - start;

    const latestTxnAt = (rows[0] as { latest_txn_at: string | null } | undefined)?.latest_txn_at ?? null;
    console.log(JSON.stringify({ handler: '/api/freshness', latestTxnAt, durationMs: duration }));

    return NextResponse.json({
      data: { latestTxnAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ handler: '/api/freshness', error: message }));
    return NextResponse.json({ error: 'bq_query_failed', message }, { status: 500 });
  }
}
