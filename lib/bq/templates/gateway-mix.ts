import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

export type GatewayMixRow = {
  aggregator_name: string;
  transaction_count: number;
  successful_count: number;
  failed_count: number;
  share_pct: number;
};

/**
 * Gateway mix — share of volume per PG in the current slice.
 * Returns rows sorted by transaction_count DESC, plus a share percentage of the slice total.
 *
 * Includes both `successful_count` AND `failed_count` so the leaderboard UI can compute
 * a meaningful success rate over terminal-state rows only — matching `metricsQuery`'s
 * definition. Without `failed_count`, the UI's only option is `success / total`, which
 * is heavily deflated for PGs with a pre-auth flow (Razorpay's `authorized` state shows
 * as `unified_status = 'pending'` until capture lands, often outside the date window).
 * Last probe: Razorpay 7,538 success / 2,308 failed / 4,568 pending → real SR = 76.6%,
 * not 52.3%.
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
      SAFE_DIVIDE(COUNT(*), (SELECT total FROM totals)) * 100 AS share_pct
    FROM slice
    GROUP BY aggregator_name
    ORDER BY transaction_count DESC
    LIMIT 20
  `;

  return { query, params: slice.params, types: slice.types };
}
