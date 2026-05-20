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

/**
 * Metric-cards query — returns 6 values for the current filter slice.
 *
 * Filter dimensions wired:
 *   - dateRange (mandatory)
 *   - aggregatorIds (PG multi-select) — applied as transaction.aggregator_id IN UNNEST(@aggregatorIds)
 *   - paymentModes (MOP multi-select) — applied as transaction.payment_mode IN UNNEST(@paymentModes)
 *
 * Not yet wired (queued):
 *   - merchantProfileIds (storefront)
 *   - sellerIds (FC seller)
 *   - orderingChannel (avis-side join)
 *   - WoW delta
 *   - avg latency
 *   - refund rate (separate query family per architecture.md)
 *
 * Per D007: V2 shape — latest-status CTE, success status set, standard exclusions.
 * Per D006: Zenith table prefixes and renames.
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
