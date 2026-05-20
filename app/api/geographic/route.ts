import { NextResponse } from 'next/server';
import { getBQ } from '@/lib/bq/client';
import { geographicQuery, type GeographicRow } from '@/lib/bq/templates/geographic';
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
    const { query, params, types } = geographicQuery(filters);
    const start = Date.now();
    const [rows] = await bq.query({
      query,
      params,
      types: types as Record<string, string>,
      location: process.env.BQ_LOCATION ?? 'US',
    });
    const duration = Date.now() - start;

    console.log(
      JSON.stringify({
        handler: '/api/geographic',
        cacheKey: filterCacheKey(filters),
        rows: rows.length,
        durationMs: duration,
      }),
    );

    return NextResponse.json({
      data: rows as GeographicRow[],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ handler: '/api/geographic', error: message }));
    return NextResponse.json({ error: 'bq_query_failed', message }, { status: 500 });
  }
}
