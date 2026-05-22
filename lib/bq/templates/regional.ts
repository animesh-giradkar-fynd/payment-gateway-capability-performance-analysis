import type { DashboardFilters } from '@/lib/filters';
import { Z, type BQQuery } from '@/lib/bq/templates/base';

export type RegionalResponse = {
  /** Flat {pincode, payment_mode, order_count} rows — the route rolls these up to states. */
  pincode_mop: Array<{ pincode: string; payment_mode: string; order_count: number }>;
  coverage: { total_orders: number; mapped: number };
};

/**
 * Regional payment-method preference — India.
 *
 * Produces one {pincode, payment_mode, order_count} row per (pincode × MOP), so the UI can
 * colour each Indian state by its dominant payment method.
 *
 * Joins:
 *   - dbe_order_transactions → order_id + cart_id (cart id lives in the order meta JSON)
 *   - sfe_cart_address       → pincode, keyed by cart_id (latest address row per cart)
 *   - dbe_transaction        → payment_mode, keyed by merchant_order_id; the latest forward
 *                              (non-refund) transaction is taken as the order's MOP
 *
 * Coverage is intentionally surfaced: only orders carrying a deliverable address pincode AND
 * a payment method can be placed on the map (~12% in recent probes). The UI shows the ratio
 * so a thin sample is never read as authoritative.
 *
 * Date range comes from the filter envelope. Other DashboardFilters dimensions are NOT
 * applied — the regional view is its own scope (the orders/address join doesn't carry the
 * telemetry slice's PG/MOP predicates).
 */
export function regionalQuery(filters: DashboardFilters): BQQuery {
  const pincodeRegex = `r'^[1-9][0-9]{5}$'`;
  const isMapped = `
    pincode IS NOT NULL
    AND REGEXP_CONTAINS(pincode, ${pincodeRegex})
    AND payment_mode IS NOT NULL
    AND payment_mode <> ''
  `;

  const query = `
    WITH
    -- Orders in the date window; cart id is extracted from the order meta JSON.
    recent_orders AS (
      SELECT
        merchant_order_id,
        JSON_VALUE(meta, '$.create_order_meta.cart._id') AS cart_id
      FROM ${Z}.dbe_order_transactions
      WHERE DATE(created_on) BETWEEN DATE(@from) AND DATE(@to)
    ),
    -- Latest address row per cart; pincode is the reliably-populated field.
    cart_addr AS (
      SELECT cart_id, pincode
      FROM (
        SELECT cart_id, pincode,
               ROW_NUMBER() OVER (PARTITION BY cart_id ORDER BY event_timestamp DESC) AS rn
        FROM ${Z}.sfe_cart_address
        WHERE cart_id IS NOT NULL
      )
      WHERE rn = 1
    ),
    -- One payment method per order: the latest forward (non-refund) transaction wins.
    order_mop AS (
      SELECT merchant_order_id, payment_mode
      FROM (
        SELECT merchant_order_id, payment_mode,
               ROW_NUMBER() OVER (
                 PARTITION BY merchant_order_id ORDER BY created_on DESC
               ) AS rn
        FROM ${Z}.dbe_transaction
        WHERE DATE(created_on) BETWEEN DATE(@from) AND DATE(@to)
          AND is_active = TRUE
          AND IFNULL(transaction_type, '') <> 'REFUND'
          AND IFNULL(payment_mode, '') <> 'PAYMENTLINK'
      )
      WHERE rn = 1
    ),
    enriched AS (
      SELECT
        ro.merchant_order_id,
        ca.pincode,
        om.payment_mode
      FROM recent_orders ro
      LEFT JOIN cart_addr ca ON ca.cart_id = ro.cart_id
      LEFT JOIN order_mop om ON om.merchant_order_id = ro.merchant_order_id
    )
    SELECT
      -- (pincode × MOP) rollup — the route maps pincode→state and payment_mode→group.
      ARRAY(
        SELECT AS STRUCT pincode, payment_mode, COUNT(*) AS order_count
        FROM enriched
        WHERE ${isMapped}
        GROUP BY pincode, payment_mode
      ) AS pincode_mop,

      -- Coverage stats for the UI disclaimer.
      STRUCT(
        COUNT(*) AS total_orders,
        COUNTIF(${isMapped}) AS mapped
      ) AS coverage
    FROM enriched
  `;

  return {
    query,
    params: { from: filters.dateRange.from, to: filters.dateRange.to },
    types: { from: 'STRING', to: 'STRING' },
  };
}
