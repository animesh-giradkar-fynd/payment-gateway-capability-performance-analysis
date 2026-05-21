import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

export type FailureReasonRow = {
  reason_code: string;
  example_description: string | null;
  failure_count: number;
  share_pct: number;
};

/**
 * Failure-reason ranking per PRD F6.
 *
 * Composes the V2 fallback logic:
 *   - Prefer JSON_VALUE(transaction.meta, '$.error_code') (gateway-emitted code)
 *   - Fall back to UPPER(aggregator_order_status_mapper.aggregator_status) (mapper-normalized)
 *   - Final fallback bucket: '(uncategorized)'
 *
 * Returns up to 25 reasons sorted by failure count, with share % of failures-within-slice.
 * Also surfaces one example error_description so the UI tooltip can show what the gateway
 * actually said the last time this reason fired.
 *
 * Independent of the top filter's PG/MOP per PRD F6 — the picker selections are passed in
 * via the DashboardFilters envelope from the panel's own state.
 */
export function failuresQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters);

  // Failure population = PG-side declines only (unified_status='failed').
  // Fynd's 2h-timeout cancels are intentionally excluded — they have no
  // diagnosable PG-reported reason. The KPI card's failure-rate subline
  // already calls out the cancelled-at-2h count separately, so leadership
  // sees the operational signal without it dominating the diagnostic chart.
  const query = `
    ${slice.sql}
    , failed AS (
      SELECT
        UPPER(
          COALESCE(
            error_code,
            raw_aggregator_status,
            '(uncategorized)'
          )
        ) AS reason_code,
        error_description,
        unified_status
      FROM slice
      WHERE unified_status = 'failed'
    )
    , total AS (SELECT COUNT(*) AS n FROM failed)
    SELECT
      reason_code,
      ANY_VALUE(error_description) AS example_description,
      COUNT(*) AS failure_count,
      SAFE_DIVIDE(COUNT(*), (SELECT n FROM total)) * 100 AS share_pct
    FROM failed
    GROUP BY reason_code
    ORDER BY failure_count DESC
    LIMIT 25
  `;

  return { query, params: slice.params, types: slice.types };
}
