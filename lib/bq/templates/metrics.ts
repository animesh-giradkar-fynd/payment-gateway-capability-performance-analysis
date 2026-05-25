import type { DashboardFilters } from '@/lib/filters';
import { previousPeriodFor } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

// Re-export so existing route-handler imports (`import { previousPeriodFor } from '@/lib/bq/templates/metrics'`)
// keep working without touching call sites. Pure date math; lives in lib/filters now.
export { previousPeriodFor };

export type MetricsRow = {
  transaction_volume: number;
  successful_count: number;
  failed_count: number;           // PG-side declines (unified_status = 'failed')
  cancelled_count: number;        // Fynd 2h-timeout cancels (unified_status = 'pending')
  success_rate_pct: number | null;
  failure_rate_pct: number | null;
  avg_transaction_value: number | null;
  successful_gmv: number | null;  // SUM(amount) on success only — the GMV KPI card
};

export type MetricsResponse = {
  current: MetricsRow;
  previous: MetricsRow | null;
};

/**
 * Metric-cards query — returns 6 values for the current filter slice.
 *
 * The route handler always runs this query twice — once for the current slice and
 * once for the previous-period slice (via `previousPeriodFor`) — and exposes both
 * via MetricsResponse, so the KPI cards can render the trajectory (↑/↓ vs prior
 * period) on first load without any user opt-in. Single-query helper keeps the
 * template focused; the route layer handles the two-call orchestration so each
 * query is independently cached by Next/SWR.
 */
export function metricsQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters);

  // SR / FR denominator = total slice volume, per Fynd's 2-hour cancel rule.
  // Any transaction not reaching a terminal PG status within 2 hours is cancelled at
  // Fynd's end, so `pending` rows are de-facto failures from the customer's POV.
  // Including them in the denominator keeps the success-rate honest to Fynd reality.
  // Source: Animesh confirmation 2026-05-21 — "we have a internal timeout of 2hrs for
  // any transactions that have not reached terminal state".
  const query = `
    ${slice.sql}
    SELECT
      COUNT(*) AS transaction_volume,
      COUNTIF(unified_status IN ('complete', 'completed', 'paid')) AS successful_count,
      COUNTIF(unified_status = 'failed') AS failed_count,
      COUNTIF(unified_status = 'pending') AS cancelled_count,
      SAFE_DIVIDE(
        COUNTIF(unified_status IN ('complete', 'completed', 'paid')),
        COUNT(*)
      ) * 100 AS success_rate_pct,
      SAFE_DIVIDE(
        COUNT(*) - COUNTIF(unified_status IN ('complete', 'completed', 'paid')),
        COUNT(*)
      ) * 100 AS failure_rate_pct,
      AVG(IF(unified_status IN ('complete', 'completed', 'paid'), amount, NULL)) AS avg_transaction_value,
      SUM(IF(unified_status IN ('complete', 'completed', 'paid'), amount, 0)) AS successful_gmv
    FROM slice
  `;

  return { query, params: slice.params, types: slice.types };
}

