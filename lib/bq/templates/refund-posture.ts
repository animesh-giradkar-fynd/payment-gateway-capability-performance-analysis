import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

export type RefundPostureRow = {
  payment_mode: string;        // raw payment_mode of the refund's original transaction
  refund_count: number;
  refund_amount: number | null;
};

/**
 * Refund posture — refund counts and amounts bucketed by payment_mode of the underlying
 * transaction. The UI then maps payment_mode → RefundMethod (Instant / Source / Store /
 * Cash) via lib/normalizations.ts to render the 4 KPI tiles from the brief.
 *
 * Why this shape rather than precomputed buckets in SQL: keeping the mapping in TS makes
 * it trivial to tweak buckets (and add new ones) without redeploying the SQL layer.
 */
export function refundPostureQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters, { refundOnly: true });

  const query = `
    ${slice.sql}
    SELECT
      COALESCE(payment_mode, '(unknown)') AS payment_mode,
      COUNT(*) AS refund_count,
      SUM(amount) AS refund_amount
    FROM slice
    GROUP BY payment_mode
    ORDER BY refund_count DESC
  `;

  return { query, params: slice.params, types: slice.types };
}
