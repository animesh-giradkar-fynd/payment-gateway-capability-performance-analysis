import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

export type GatewayMixRow = {
  aggregator_name: string;
  transaction_count: number;
  successful_count: number;
  failed_count: number;           // PG-side declines (unified_status = 'failed')
  cancelled_count: number;        // Fynd 2h-timeout cancels (unified_status = 'pending')
  share_pct: number;
};

/**
 * Gateway mix — share of volume per PG in the current slice.
 * Returns rows sorted by transaction_count DESC, plus a share percentage of the slice total.
 *
 * Per Animesh's 2026-05-21 confirmation, Fynd has an internal 2-hour timeout — any
 * transaction not reaching a terminal PG state within 2 hours is cancelled at Fynd's end.
 * So `unified_status = 'pending'` rows in our slice (e.g. Razorpay `authorized` that
 * never got captured) are effectively failed from the customer / Fynd POV. The UI
 * therefore computes Success Rate as `successful / transaction_count` (= successful /
 * (successful + failed + cancelled + uncategorized)) — matching `metricsQuery`.
 *
 * Surfaces `cancelled_count` separately so the leaderboard tooltip can show
 * "Cancelled at Fynd (2h timeout)" as a distinct breakdown line.
 */
export function gatewayMixQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters);

  const query = `
    ${slice.sql}
    , totals AS (SELECT COUNT(*) AS total FROM slice)
    SELECT
      COALESCE(aggregator_name, '(unknown)') AS aggregator_name,
      COUNT(*) AS transaction_count,
      COUNTIF(unified_status IN ('complete', 'completed', 'paid')) AS successful_count,
      COUNTIF(unified_status = 'failed') AS failed_count,
      COUNTIF(unified_status = 'pending') AS cancelled_count,
      SAFE_DIVIDE(COUNT(*), (SELECT total FROM totals)) * 100 AS share_pct
    FROM slice
    GROUP BY aggregator_name
    ORDER BY transaction_count DESC
    LIMIT 20
  `;

  return { query, params: slice.params, types: slice.types };
}
