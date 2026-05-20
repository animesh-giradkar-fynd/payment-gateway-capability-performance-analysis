import { Z, type BQQuery } from '@/lib/bq/templates/base';

export type FilterOptionsRow = {
  aggregators: { aggregator_id: number; aggregator_name: string; transaction_count: number }[];
  payment_modes: { payment_mode: string; transaction_count: number }[];
};

/**
 * Filter-bar dropdown data — distinct active PGs and MOPs in the last 90 days, ranked by
 * recent volume so the most-relevant options surface first. Cached aggressively (1h TTL)
 * because it changes slowly.
 */
export function filterOptionsQuery(): BQQuery {
  const query = `
    WITH recent AS (
      SELECT
        t.aggregator_id,
        agg.name AS aggregator_name,
        t.payment_mode
      FROM ${Z}.transaction t
      LEFT JOIN ${Z}.aggregator agg ON agg.aggregator_id = t.aggregator_id
      LEFT JOIN ${Z}.merchant_profile mp ON mp.id = t.merchant_profile_id
      LEFT JOIN ${Z}.merchant m ON m.id = mp.merchant_id
      WHERE DATE(t.created_on) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND t.is_active = TRUE
        AND LOWER(IFNULL(m.name, '')) NOT LIKE '%test%'
        AND IFNULL(agg.name, '') <> 'Openapi'
        AND IFNULL(t.payment_mode, '') <> 'PAYMENTLINK'
        AND IFNULL(t.transaction_type, '') <> 'REFUND'
    ),
    aggs AS (
      SELECT
        ARRAY_AGG(
          STRUCT(aggregator_id, aggregator_name, transaction_count)
          ORDER BY transaction_count DESC
        ) AS aggregators
      FROM (
        SELECT aggregator_id, aggregator_name, COUNT(*) AS transaction_count
        FROM recent
        WHERE aggregator_id IS NOT NULL AND aggregator_name IS NOT NULL
        GROUP BY aggregator_id, aggregator_name
      )
    ),
    mops AS (
      SELECT
        ARRAY_AGG(
          STRUCT(payment_mode, transaction_count)
          ORDER BY transaction_count DESC
        ) AS payment_modes
      FROM (
        SELECT payment_mode, COUNT(*) AS transaction_count
        FROM recent
        WHERE payment_mode IS NOT NULL
        GROUP BY payment_mode
      )
    )
    SELECT aggs.aggregators, mops.payment_modes
    FROM aggs, mops
  `;

  return { query, params: {}, types: {} };
}
