import type { DashboardFilters } from '@/lib/filters';
import { Z, type BQQuery } from '@/lib/bq/templates/base';

export type RegionalResponse = {
  /** Flat {delivery_state, payment_mode, order_count} rows — the route canonicalizes + rolls up. */
  state_mop: Array<{ delivery_state: string; payment_mode: string; order_count: number }>;
  coverage: { total_orders: number };
};

/**
 * Regional payment-method preference — India.
 *
 * One {delivery_state, payment_mode, order_count} row per (state × MOP), so the UI can
 * shade each state by the share of any payment method.
 *
 * Sources:
 *   - dbe_transaction → one payment method per order (latest forward / non-refund txn)
 *   - dbe_shipments   → delivery_state, keyed by order_id. dbe_shipments is the order-
 *                       fulfilment DB mirror; delivery_state is ~98% populated and the
 *                       order_id == merchant_order_id join matches ~99.9% of orders.
 *
 * The earlier sfe_cart_address join is gone — that was a storefront *clickstream-event*
 * table (session_id / user_agent / utm_params …) that only logged ~12% of orders. The
 * delivery address always exists; it lives on the shipment.
 *
 * Date range comes from the filter envelope. Other DashboardFilters dimensions are NOT
 * applied — the regional view is intentionally its own scope.
 */
export function regionalQuery(filters: DashboardFilters): BQQuery {
  const query = `
    WITH
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
    -- Delivery state per order from its forward shipment. The created_on window is
    -- padded ±30d so shipments raised a little after the order still join.
    shipment_addr AS (
      SELECT order_id, ANY_VALUE(delivery_state) AS delivery_state
      FROM ${Z}.dbe_shipments
      WHERE DATE(created_on) BETWEEN DATE_SUB(DATE(@from), INTERVAL 30 DAY)
                                AND DATE_ADD(DATE(@to), INTERVAL 30 DAY)
        AND journey_type = 'forward'
        AND delivery_state IS NOT NULL
        AND delivery_state <> ''
      GROUP BY order_id
    ),
    enriched AS (
      SELECT
        om.merchant_order_id,
        om.payment_mode,
        sa.delivery_state
      FROM order_mop om
      LEFT JOIN shipment_addr sa ON sa.order_id = om.merchant_order_id
    )
    SELECT
      ARRAY(
        SELECT AS STRUCT delivery_state, payment_mode, COUNT(*) AS order_count
        FROM enriched
        WHERE delivery_state IS NOT NULL
          AND payment_mode IS NOT NULL
          AND payment_mode <> ''
        GROUP BY delivery_state, payment_mode
      ) AS state_mop,
      STRUCT(COUNT(*) AS total_orders) AS coverage
    FROM enriched
  `;

  return {
    query,
    params: { from: filters.dateRange.from, to: filters.dateRange.to },
    types: { from: 'STRING', to: 'STRING' },
  };
}
