import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery, Z } from '@/lib/bq/templates/base';

export type SurfaceRow = {
  ordering_source: string;
  transaction_count: number;
  successful_count: number;
  total_amount: number;
  successful_amount: number;
};

/**
 * "Transactions by surface" — groups by `dbe_orders.ordering_source`, the real surface
 * dimension (online storefront / in-store POS / headless Nexus). Replaces the previous
 * implementation which grouped by `merchant_profile.name` (storefront brand) and had
 * (unknown) as the second-largest bucket because ~31% of Razorpay-on-storefront txns
 * have a NULL profile_name. By design the panel now inlines a LEFT JOIN to dbe_orders
 * (not via buildSliceCTE's opt-in join) since the entire panel's GROUP BY needs it.
 *
 * `HAVING COUNT(*) >= 50` strips garbage values (e.g. test rows like 'pi694iRig')
 * without hardcoding their names — resilient to new noise.
 */
export function surfaceQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters);

  const query = `
    ${slice.sql}
    , slice_with_source AS (
      SELECT s.*, zo.ordering_source
      FROM slice s
      LEFT JOIN ${Z}.dbe_orders zo
        ON zo.order_id = s.merchant_order_id
    )
    SELECT
      ordering_source,
      COUNT(*) AS transaction_count,
      COUNTIF(unified_status IN ('complete', 'completed', 'paid')) AS successful_count,
      SUM(amount) AS total_amount,
      SUM(IF(unified_status IN ('complete', 'completed', 'paid'), amount, 0)) AS successful_amount
    FROM slice_with_source
    WHERE ordering_source IS NOT NULL
    GROUP BY ordering_source
    HAVING COUNT(*) >= 50
    ORDER BY transaction_count DESC
  `;

  return { query, params: slice.params, types: slice.types };
}
