import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

export type GatewayMixRow = {
  aggregator_name: string;
  transaction_count: number;
  successful_count: number;
  share_pct: number;
};

/**
 * Gateway mix — share of volume per PG in the current slice.
 * Returns rows sorted by transaction_count DESC, plus a share percentage of the slice total.
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
      SAFE_DIVIDE(COUNT(*), (SELECT total FROM totals)) * 100 AS share_pct
    FROM slice
    GROUP BY aggregator_name
    ORDER BY transaction_count DESC
    LIMIT 20
  `;

  return { query, params: slice.params, types: slice.types };
}
