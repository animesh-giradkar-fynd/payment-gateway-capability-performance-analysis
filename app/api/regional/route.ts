import { NextResponse } from 'next/server';
import { getBQ } from '@/lib/bq/client';
import { regionalQuery, type RegionalResponse } from '@/lib/bq/templates/regional';
import { parseFilters, filterCacheKey } from '@/lib/filters';
import { rollupPincodeMop } from '@/lib/pincode-to-state';

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
    const { query, params, types } = regionalQuery(filters);
    const start = Date.now();
    const [rows] = await bq.query({
      query,
      params,
      types: types as Record<string, string>,
      location: process.env.BQ_LOCATION ?? 'US',
    });
    const duration = Date.now() - start;
    const row = (rows[0] as RegionalResponse | undefined) ?? null;

    // Roll pincode×MOP rows up to per-state MOP breakdowns server-side, so the browser
    // payload is a compact ~36-state array rather than thousands of pincode rows.
    const states = row ? rollupPincodeMop(row.pincode_mop ?? []) : [];
    const coverage = row?.coverage ?? { total_orders: 0, mapped: 0 };

    console.log(JSON.stringify({
      handler: '/api/regional',
      cacheKey: filterCacheKey(filters),
      states: states.length,
      mapped: coverage.mapped,
      durationMs: duration,
    }));

    return NextResponse.json({
      data: { states, coverage },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ handler: '/api/regional', error: message }));
    return NextResponse.json({ error: 'bq_query_failed', message }, { status: 500 });
  }
}
