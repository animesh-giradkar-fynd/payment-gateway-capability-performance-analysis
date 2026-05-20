import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getBQ } from '@/lib/bq/client';
import { mopMixQuery, type MopMixRow } from '@/lib/bq/templates/mop-mix';
import { parseFilters, filterCacheKey } from '@/lib/filters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
    const { query, params, types } = mopMixQuery(filters);
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
        handler: '/api/mop-mix',
        cacheKey: filterCacheKey(filters),
        rows: rows.length,
        durationMs: duration,
      }),
    );

    return NextResponse.json({
      data: rows as MopMixRow[],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ handler: '/api/mop-mix', error: message }));
    return NextResponse.json({ error: 'bq_query_failed', message }, { status: 500 });
  }
}
