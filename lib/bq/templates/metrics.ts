import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

export type MetricsRow = {
  transaction_volume: number;
  successful_count: number;
  failed_count: number;
  success_rate_pct: number | null;
  failure_rate_pct: number | null;
  avg_ticket_size: number | null;
};

export type MetricsResponse = {
  current: MetricsRow;
  previous: MetricsRow | null;
};

/**
 * Metric-cards query — returns 6 values for the current filter slice.
 *
 * When `filters.compareToPreviousPeriod` is true, the route handler runs this query a
 * second time with the previous-period date range and exposes both via MetricsResponse.
 * Single-query helper keeps the template focused; the route layer handles the two-call
 * orchestration so each query is independently cached by Next/SWR.
 */
export function metricsQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters);

  const query = `
    ${slice.sql}
    SELECT
      COUNT(*) AS transaction_volume,
      COUNTIF(unified_status IN ('complete', 'completed', 'paid')) AS successful_count,
      COUNTIF(unified_status = 'failed') AS failed_count,
      SAFE_DIVIDE(
        COUNTIF(unified_status IN ('complete', 'completed', 'paid')),
        COUNTIF(unified_status IN ('complete', 'completed', 'paid', 'failed'))
      ) * 100 AS success_rate_pct,
      SAFE_DIVIDE(
        COUNTIF(unified_status = 'failed'),
        COUNTIF(unified_status IN ('complete', 'completed', 'paid', 'failed'))
      ) * 100 AS failure_rate_pct,
      AVG(IF(unified_status IN ('complete', 'completed', 'paid'), amount, NULL)) AS avg_ticket_size
    FROM slice
  `;

  return { query, params: slice.params, types: slice.types };
}

/**
 * Given a date range, compute the equal-length window immediately preceding it.
 * Used for the WoW delta — if filter is "Apr 21 → May 20" (30 days), previous is
 * "Mar 22 → Apr 20".
 */
export function previousPeriodFor(filters: DashboardFilters): DashboardFilters {
  const from = new Date(filters.dateRange.from + 'T00:00:00Z');
  const to = new Date(filters.dateRange.to + 'T00:00:00Z');
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { ...filters, dateRange: { from: fmt(prevFrom), to: fmt(prevTo) } };
}
