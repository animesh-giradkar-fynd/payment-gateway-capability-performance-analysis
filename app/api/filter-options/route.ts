import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getBQ } from '@/lib/bq/client';
import { filterOptionsQuery, type FilterOptionsRow } from '@/lib/bq/templates/filter-options';

export const runtime = 'nodejs';
// Cache for 1 hour at the Next.js Data Cache layer — filter dropdown contents change slowly.
export const revalidate = 3600;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const bq = getBQ();
    const { query } = filterOptionsQuery();
    const start = Date.now();
    const [rows] = await bq.query({
      query,
      location: process.env.BQ_LOCATION ?? 'US',
    });
    const duration = Date.now() - start;

    const row = (rows[0] as FilterOptionsRow | undefined) ?? {
      aggregators: [],
      payment_modes: [],
    };

    console.log(
      JSON.stringify({
        handler: '/api/filter-options',
        aggregators: row.aggregators?.length ?? 0,
        payment_modes: row.payment_modes?.length ?? 0,
        durationMs: duration,
      }),
    );

    return NextResponse.json({ data: row, generatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ handler: '/api/filter-options', error: message }));
    return NextResponse.json({ error: 'bq_query_failed', message }, { status: 500 });
  }
}
