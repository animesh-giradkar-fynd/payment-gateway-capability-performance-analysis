import type { DashboardFilters } from '@/lib/filters';

const PROJECT = process.env.BQ_PROJECT ?? 'fynd-jio-commerceml-prod';
const DATASET = process.env.BQ_DATASET ?? 'fynd_zenith_data';
const Z = `\`${PROJECT}.${DATASET}\``;

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
 * Source-of-truth shape: V2 query in architecture.md Appendix A, applied with D006
 * column translations:
 *   - aggregator.aggregator_id (not aggregator.id)
 *   - latest_status pattern via ROW_NUMBER() PARTITION BY transaction_id
 *   - success status set: 'complete' / 'completed' / 'paid'
 *   - standard exclusions: test brands, Openapi, PAYMENTLINK, REFUND
 *
 * NOT YET WIRED (queued for M2):
 *   - PG filter (filters.aggregatorIds → WHERE aggregator IN UNNEST(@pg))
 *   - MOP filter (filters.paymentModes → WHERE payment_mode IN UNNEST(@mop))
 *   - Storefront / Merchant Profile filter
 *   - Ordering Channel filter (requires the avis-side `orders` join — adds latency)
 *   - Refund rate (separate query family per architecture.md)
 *   - Avg latency (derived from status_created_on - transaction.created_on; trust pending)
 *   - WoW deltas (run the same query twice with offset dates)
 *
 * @param filters validated DashboardFilters envelope (only dateRange is used in M1).
 */
export function metricsQuery(filters: DashboardFilters) {
  const query = `
    WITH latest_status AS (
      SELECT
        transaction_id,
        id AS status_mapper_id,
        ROW_NUMBER() OVER (PARTITION BY transaction_id ORDER BY id DESC) AS rn
      FROM ${Z}.transaction_status
      WHERE DATE(created_on) BETWEEN @from AND @to
    ),
    joined AS (
      SELECT
        t.id AS transaction_id,
        t.amount,
        t.created_on,
        agg_map.status AS unified_status,
        m.name AS brand_name,
        agg.name AS aggregator_name,
        t.payment_mode,
        t.transaction_type
      FROM ${Z}.transaction t
      LEFT JOIN latest_status ls
        ON ls.transaction_id = t.id AND ls.rn = 1
      LEFT JOIN ${Z}.aggregator_order_status_mapper agg_map
        ON agg_map.id = ls.status_mapper_id
      LEFT JOIN ${Z}.aggregator agg
        ON agg.aggregator_id = t.aggregator_id
      LEFT JOIN ${Z}.merchant_profile mp
        ON mp.id = t.merchant_profile_id
      LEFT JOIN ${Z}.merchant m
        ON m.id = mp.merchant_id
      WHERE DATE(t.created_on) BETWEEN @from AND @to
        AND t.is_active = TRUE
    )
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
    FROM joined
    WHERE LOWER(IFNULL(brand_name, '')) NOT LIKE '%test%'
      AND IFNULL(aggregator_name, '') <> 'Openapi'
      AND IFNULL(payment_mode, '') <> 'PAYMENTLINK'
      AND IFNULL(transaction_type, '') <> 'REFUND'
  `;

  return {
    query,
    params: {
      from: filters.dateRange.from,
      to: filters.dateRange.to,
    },
    types: {
      from: 'DATE',
      to: 'DATE',
    } as const,
  };
}
