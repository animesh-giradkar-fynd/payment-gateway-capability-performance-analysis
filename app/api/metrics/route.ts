import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getBQ } from '@/lib/bq/client';
import {
  metricsQuery,
  previousPeriodFor,
  type MetricsRow,
  type MetricsResponse,
} from '@/lib/bq/templates/metrics';
import { parseFilters, filterCacheKey } from '@/lib/filters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

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
    const location = process.env.BQ_LOCATION ?? 'US';
    const start = Date.now();

    const current = metricsQuery(filters);
    const queries: Array<Promise<MetricsRow | null>> = [
      bq.query({
        query: current.query,
        params: current.params,
        types: current.types as Record<string, string>,
        location,
      }).then(([rows]) => (rows[0] as MetricsRow | undefined) ?? null),
    ];

    if (filters.compareToPreviousPeriod) {
      const prev = metricsQuery(previousPeriodFor(filters));
      queries.push(
        bq.query({
          query: prev.query,
          params: prev.params,
          types: prev.types as Record<string, string>,
          location,
        }).then(([rows]) => (rows[0] as MetricsRow | undefined) ?? null),
      );
    }

    const [currentRow, previousRow = null] = await Promise.all(queries);
    const duration = Date.now() - start;

    console.log(
      JSON.stringify({
        handler: '/api/metrics',
        cacheKey: filterCacheKey(filters),
        compare: filters.compareToPreviousPeriod,
        durationMs: duration,
      }),
    );

    const response: MetricsResponse = {
      current: currentRow ?? {
        transaction_volume: 0,
        successful_count: 0,
        failed_count: 0,
        success_rate_pct: null,
        failure_rate_pct: null,
        avg_ticket_size: null,
      },
      previous: previousRow,
    };

    return NextResponse.json({ data: response, generatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ handler: '/api/metrics', error: message }));
    return NextResponse.json({ error: 'bq_query_failed', message }, { status: 500 });
  }
}
