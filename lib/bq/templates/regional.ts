import type { DashboardFilters } from '@/lib/filters';
import { Z, type BQQuery } from '@/lib/bq/templates/base';

export type RegionalResponse = {
  india_pincodes: Array<{ pincode: string; order_count: number }>;
  global_countries: Array<{ country_iso_code: string; country: string | null; order_count: number }>;
  coverage: { total_orders: number; with_pincode: number; with_country: number };
};

/**
 * Regional aggregation for the India + Global heatmaps.
 *
 * Data sources (different paths for different coverage):
 *   - India pincodes:    sfe_cart_address joined via cart_id from dbe_order_transactions.meta
 *                        (~12% coverage of orders in last probe)
 *   - Global countries:  union of two paths:
 *                        a) sfe_cart_address.country_iso_code (sparse; ~0% from probe)
 *                        b) dbe_orders.meta.custom_cart_meta.delivery_address.country_iso_code
 *                           (~0.8% — mostly Malaysia)
 *                        + pincode-implied IN for the India set
 *
 * Returns top-200 pincodes and a country rollup, plus coverage counts so the UI can
 * honestly show "<x>% of orders carry a deliverable address."
 *
 * Date range comes from the filter envelope; other DashboardFilters dimensions
 * (aggregatorIds, paymentModes, etc.) are NOT applied here — regional view is
 * intentionally separate from the telemetry slice, since the underlying orders join
 * is its own scope.
 */
export function regionalQuery(filters: DashboardFilters): BQQuery {
  const query = `
    WITH
    -- Orders in the date window
    recent_orders AS (
      SELECT
        merchant_order_id,
        JSON_VALUE(meta, '$.create_order_meta.cart._id') AS cart_id
      FROM ${Z}.dbe_order_transactions
      WHERE DATE(created_on) BETWEEN DATE(@from) AND DATE(@to)
    ),
    -- Latest address row per cart from sfe_cart_address (pincode is the populated field)
    cart_addr AS (
      SELECT cart_id, pincode, country_iso_code, country, state
      FROM (
        SELECT cart_id, pincode, country_iso_code, country, state,
               ROW_NUMBER() OVER (PARTITION BY cart_id ORDER BY event_timestamp DESC) AS rn
        FROM ${Z}.sfe_cart_address
        WHERE cart_id IS NOT NULL
      )
      WHERE rn = 1
    ),
    -- Order-meta address path (separate from cart, covers MY orders).
    -- dbe_orders.order_id joins to dbe_order_transactions.merchant_order_id.
    order_addr AS (
      SELECT
        order_id AS merchant_order_id,
        JSON_VALUE(meta, '$.custom_cart_meta.delivery_address.country_iso_code') AS country_iso_code,
        JSON_VALUE(meta, '$.custom_cart_meta.delivery_address.country') AS country
      FROM ${Z}.dbe_orders
      WHERE DATE(created_on) BETWEEN DATE(@from) AND DATE(@to)
        AND JSON_VALUE(meta, '$.custom_cart_meta.delivery_address.country_iso_code') IS NOT NULL
    ),
    -- Combined: each order gets a pincode (where available) and a country (best-of-both paths)
    enriched AS (
      SELECT
        ro.merchant_order_id,
        ca.pincode,
        -- Country preference: order_meta > cart_addr > implied-IN-if-pincode-present
        COALESCE(
          oa.country_iso_code,
          ca.country_iso_code,
          IF(ca.pincode IS NOT NULL AND REGEXP_CONTAINS(ca.pincode, r'^[1-9][0-9]{5}$'), 'IN', NULL)
        ) AS country_iso_code,
        COALESCE(oa.country, ca.country) AS country_name
      FROM recent_orders ro
      LEFT JOIN cart_addr ca ON ca.cart_id = ro.cart_id
      LEFT JOIN order_addr oa ON oa.merchant_order_id = ro.merchant_order_id
    )
    SELECT
      -- India pincode rollup (top 200 by order count)
      ARRAY(
        SELECT AS STRUCT pincode, COUNT(*) AS order_count
        FROM enriched
        WHERE pincode IS NOT NULL
          AND REGEXP_CONTAINS(pincode, r'^[1-9][0-9]{5}$')
        GROUP BY pincode
        ORDER BY order_count DESC
        LIMIT 200
      ) AS india_pincodes,

      -- Global country rollup
      ARRAY(
        SELECT AS STRUCT
          country_iso_code,
          ANY_VALUE(country_name) AS country,
          COUNT(*) AS order_count
        FROM enriched
        WHERE country_iso_code IS NOT NULL
        GROUP BY country_iso_code
        ORDER BY order_count DESC
      ) AS global_countries,

      -- Coverage stats for the UI disclaimer
      STRUCT(
        COUNT(*) AS total_orders,
        COUNTIF(pincode IS NOT NULL) AS with_pincode,
        COUNTIF(country_iso_code IS NOT NULL) AS with_country
      ) AS coverage
    FROM enriched
  `;

  return {
    query,
    params: { from: filters.dateRange.from, to: filters.dateRange.to },
    types: { from: 'STRING', to: 'STRING' },
  };
}
