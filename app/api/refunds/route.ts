import { NextResponse } from 'next/server';
import { getBQ } from '@/lib/bq/client';
import { refundsQuery, type RefundsResponse } from '@/lib/bq/templates/refunds';
import { parseFilters, filterCacheKey } from '@/lib/filters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let filters;
  try {
    filters = parseFilters(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_filters', message: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  try {
    const bq = getBQ();
    const { query, params, types } = refundsQuery(filters);
    const start = Date.now();
    const [rows] = await bq.query({
      query,
      params,
      types: types as Record<string, string>,
      location: process.env.BQ_LOCATION ?? 'US',
    });
    const duration = Date.now() - start;

    const row = (rows[0] as RefundsResponse | undefined) ?? null;

    console.log(
      JSON.stringify({
        handler: '/api/refunds',
        cacheKey: filterCacheKey(filters),
        refundCount: row?.summary?.refund_count ?? 0,
        statusBuckets: row?.by_status?.length ?? 0,
        failureReasons: row?.top_failure_reasons?.length ?? 0,
        durationMs: duration,
      }),
    );

    return NextResponse.json({ data: row, generatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ handler: '/api/refunds', error: message }));
    return NextResponse.json({ error: 'bq_query_failed', message }, { status: 500 });
  }
}
