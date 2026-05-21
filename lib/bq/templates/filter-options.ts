import { Z, type BQQuery } from '@/lib/bq/templates/base';

export type FilterOptionsRow = {
  aggregators: { aggregator_id: number; aggregator_name: string; transaction_count: number }[];
  payment_modes: { payment_mode: string; transaction_count: number }[];
  merchant_profiles: { merchant_profile_id: number; profile_name: string; transaction_count: number }[];
  sellers: { seller_id: number; seller_name: string; transaction_count: number }[];
  ordering_channels: { ordering_channel: string; transaction_count: number }[];
};

/**
 * Filter-bar dropdown data — distinct active PGs, MOPs, merchant profiles, sellers, and
 * ordering channels in the last 90 days, ranked by recent volume. Cached 1h.
 *
 * Sellers are capped at top 200 to keep the dropdown responsive; URL-based filter still
 * works for less-common sellers via direct ?seller=<id> permalinks.
 */
export function filterOptionsQuery(): BQQuery {
  const query = `
    WITH
    -- dbe_aggregator has duplicate aggregator_id rows; dedupe to one canonical name
    -- per id so the dropdown doesn't show "Razorpay" twice and counts don't double.
    -- ORDER BY LENGTH(name) DESC first so placeholder single-char rows (e.g. 'd' for
    -- Razorpay Magic Checkout id=195) lose to the real label, then modified_on as
    -- tiebreaker among equally-long names. Kept in lockstep with base.ts.
    aggregator_dedup AS (
      SELECT aggregator_id, name FROM (
        SELECT aggregator_id, name,
               ROW_NUMBER() OVER (
                 PARTITION BY aggregator_id
                 ORDER BY LENGTH(name) DESC NULLS LAST, modified_on DESC NULLS LAST
               ) AS rn
        FROM ${Z}.dbe_aggregator
      )
      WHERE rn = 1
    ),
    recent AS (
      SELECT
        t.aggregator_id,
        agg.name AS aggregator_name,
        t.payment_mode,
        t.merchant_profile_id,
        mp.name AS profile_name,
        m.id AS seller_id,
        m.name AS seller_name,
        zo.ordering_source
      FROM ${Z}.dbe_transaction t
      LEFT JOIN aggregator_dedup agg ON agg.aggregator_id = t.aggregator_id
      LEFT JOIN ${Z}.dbe_merchant_profile mp ON mp.id = t.merchant_profile_id
      LEFT JOIN ${Z}.dbe_merchant m ON m.id = mp.merchant_id
      LEFT JOIN ${Z}.dbe_orders zo ON zo.order_id = t.merchant_order_id
      WHERE DATE(t.created_on) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND t.is_active = TRUE
        AND LOWER(IFNULL(m.name, '')) NOT LIKE '%test%'
        -- Same aggregator exclusion as buildSliceCTE in base.ts — keep the dropdown
        -- showing only real customer-facing PGs. Edit both files in lockstep.
        AND LOWER(IFNULL(agg.name, '')) NOT IN (
          'fynd', 'creditnote', 'store credits', 'credit', 'openapi',
          'payment-fahim', 'asmakhanextprod'
        )
        AND LOWER(IFNULL(agg.name, '')) NOT LIKE '%test%'
        AND LOWER(IFNULL(agg.name, '')) NOT LIKE '%uat%'
        AND LOWER(IFNULL(agg.name, '')) NOT LIKE '%dev%'
        AND LOWER(IFNULL(agg.name, '')) NOT LIKE '%sandbox%'
        AND IFNULL(t.payment_mode, '') <> 'PAYMENTLINK'
        AND IFNULL(t.transaction_type, '') <> 'REFUND'
    )
    SELECT
      ARRAY(
        SELECT AS STRUCT aggregator_id, aggregator_name, COUNT(*) AS transaction_count
        FROM recent
        WHERE aggregator_id IS NOT NULL AND aggregator_name IS NOT NULL
        GROUP BY aggregator_id, aggregator_name
        ORDER BY transaction_count DESC
      ) AS aggregators,
      ARRAY(
        SELECT AS STRUCT payment_mode, COUNT(*) AS transaction_count
        FROM recent
        WHERE payment_mode IS NOT NULL
        GROUP BY payment_mode
        ORDER BY transaction_count DESC
      ) AS payment_modes,
      ARRAY(
        SELECT AS STRUCT merchant_profile_id, profile_name, COUNT(*) AS transaction_count
        FROM recent
        WHERE merchant_profile_id IS NOT NULL AND profile_name IS NOT NULL
        GROUP BY merchant_profile_id, profile_name
        ORDER BY transaction_count DESC
        LIMIT 100
      ) AS merchant_profiles,
      ARRAY(
        SELECT AS STRUCT seller_id, seller_name, COUNT(*) AS transaction_count
        FROM recent
        WHERE seller_id IS NOT NULL AND seller_name IS NOT NULL
        GROUP BY seller_id, seller_name
        ORDER BY transaction_count DESC
        LIMIT 200
      ) AS sellers,
      ARRAY(
        SELECT AS STRUCT ordering_source AS ordering_channel, COUNT(*) AS transaction_count
        FROM recent
        WHERE ordering_source IS NOT NULL
        GROUP BY ordering_source
        ORDER BY transaction_count DESC
      ) AS ordering_channels
  `;

  return { query, params: {}, types: {} };
}
