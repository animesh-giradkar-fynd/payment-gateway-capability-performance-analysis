import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

export type RefundsResponse = {
  summary: {
    refund_count: number;
    total_refund_amount: number | null;
  };
  by_status: Array<{ status: string; count: number; share_pct: number }>;
  top_failure_reasons: Array<{ reason_code: string; example_description: string | null; failure_count: number }>;
};

/**
 * Refund posture query per PRD F7.
 *
 * Uses the refund query family (transaction_type = 'REFUND' via buildSliceCTE refundOnly).
 *
 * Returns three nested aggregations in a single round trip:
 *   1. summary — total refund count and total refunded amount
 *   2. by_status — distribution across INITIATED / PENDING / COMPLETED / FAILED / DONE etc.
 *   3. top_failure_reasons — when status = 'failed', composed via the same fallback chain as
 *      the failures panel.
 *
 * NOT IN THIS QUERY (deferred): OFFLINE / ONLINE / BOTH refund mode mix per PRD F7. The
 * source column for that enum in Zenith is unverified — needs a dataset inspection before
 * we can wire it. UI surfaces a placeholder section that flags this.
 */
export function refundsQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters, { refundOnly: true });

  const query = `
    ${slice.sql}
    SELECT
      STRUCT(
        (SELECT COUNT(*) FROM slice) AS refund_count,
        (SELECT SUM(amount) FROM slice) AS total_refund_amount
      ) AS summary,
      ARRAY(
        SELECT AS STRUCT
          COALESCE(unified_status, '(unknown)') AS status,
          COUNT(*) AS count,
          SAFE_DIVIDE(COUNT(*), (SELECT COUNT(*) FROM slice)) * 100 AS share_pct
        FROM slice
        GROUP BY unified_status
        ORDER BY count DESC
      ) AS by_status,
      ARRAY(
        SELECT AS STRUCT
          UPPER(
            COALESCE(error_code, raw_aggregator_status, '(uncategorized)')
          ) AS reason_code,
          ANY_VALUE(error_description) AS example_description,
          COUNT(*) AS failure_count
        FROM slice
        WHERE unified_status = 'failed'
        GROUP BY reason_code
        ORDER BY failure_count DESC
        LIMIT 10
      ) AS top_failure_reasons
  `;

  return { query, params: slice.params, types: slice.types };
}
