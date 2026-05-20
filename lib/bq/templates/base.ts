import type { DashboardFilters } from '@/lib/filters';

const PROJECT = process.env.BQ_PROJECT ?? 'fynd-jio-commerceml-prod';
const DATASET = process.env.BQ_DATASET ?? 'fynd_zenith_data';
export const Z = `\`${PROJECT}.${DATASET}\``;

export type BQQuery = {
  query: string;
  params: Record<string, unknown>;
  types: Record<string, string | string[]>;
};

export type SliceOptions = {
  /**
   * If true, includes ONLY transactions where transaction_type = 'REFUND' (refund query family
   * per architecture.md / D007). If false / undefined, EXCLUDES refunds (telemetry query family).
   */
  refundOnly?: boolean;
};

/**
 * Reusable CTE that produces the base `slice` row set every telemetry panel queries against.
 * Encodes the V2 query shape (D007) translated to Zenith (D006):
 *   - Latest-status pattern via ROW_NUMBER() PARTITION BY transaction_id ORDER BY id DESC
 *   - LEFT JOINs: transaction → latest_status → aggregator_order_status_mapper → aggregator
 *                 → merchant_profile → merchant
 *   - Date-range constraint on both transaction.created_on and transaction_status.created_on
 *   - is_active = TRUE on transaction
 *   - Standard exclusions: test brands, Openapi, PAYMENTLINK
 *   - transaction_type filter: telemetry queries exclude REFUND; refund queries require REFUND
 *   - Optional filters: aggregatorIds, paymentModes, merchantProfileIds — applied conditionally
 *
 * Projects `transaction.meta` JSON extracts (error_code / error_reason / error_description)
 * per V2 query. If `transaction.meta` doesn't exist in Zenith at runtime, the query fails at
 * parse time — drop the three JSON_VALUE lines below and the failures panel falls back to
 * mapper-only reasons.
 *
 * The caller composes its own SELECT / GROUP BY on top of the `slice` CTE.
 */
export function buildSliceCTE(
  filters: DashboardFilters,
  options: SliceOptions = {},
): {
  sql: string;
  params: Record<string, unknown>;
  types: Record<string, string | string[]>;
} {
  const params: Record<string, unknown> = {
    from: filters.dateRange.from,
    to: filters.dateRange.to,
  };
  const types: Record<string, string | string[]> = {
    from: 'DATE',
    to: 'DATE',
  };

  // Conditional filter predicates — only emitted when the array is non-empty.
  // BQ's IN UNNEST(@arr) on an empty array would return false for every row, so
  // omitting the predicate entirely is the "no filter" path.
  const extraPredicates: string[] = [];

  if (filters.aggregatorIds?.length) {
    extraPredicates.push('t.aggregator_id IN UNNEST(@aggregatorIds)');
    params.aggregatorIds = filters.aggregatorIds;
    types.aggregatorIds = ['INT64'];
  }
  if (filters.paymentModes?.length) {
    extraPredicates.push('t.payment_mode IN UNNEST(@paymentModes)');
    params.paymentModes = filters.paymentModes;
    types.paymentModes = ['STRING'];
  }
  if (filters.merchantProfileIds?.length) {
    extraPredicates.push('t.merchant_profile_id IN UNNEST(@merchantProfileIds)');
    params.merchantProfileIds = filters.merchantProfileIds;
    types.merchantProfileIds = ['INT64'];
  }
  if (filters.sellerIds?.length) {
    // FC Seller filter — sellerIds are merchant.id (the brand), so we filter via the
    // merchant_profile → merchant join chain. mp.merchant_id is the FK on merchant_profile.
    extraPredicates.push('mp.merchant_id IN UNNEST(@sellerIds)');
    params.sellerIds = filters.sellerIds;
    types.sellerIds = ['INT64'];
  }

  // Ordering Channel requires a join to avis-side `orders` table — only emit when filter is set
  // (the join is a small additional scan cost we don't want to pay on every query otherwise).
  const joinOrders = !!filters.orderingChannel?.length;
  const ordersJoinSql = joinOrders
    ? `LEFT JOIN ${Z}.dbe_orders zo ON zo.order_id = t.merchant_order_id`
    : '';
  if (joinOrders && filters.orderingChannel) {
    extraPredicates.push('zo.ordering_source IN UNNEST(@orderingChannel)');
    params.orderingChannel = filters.orderingChannel;
    types.orderingChannel = ['STRING'];
  }

  const extraClause = extraPredicates.length ? `AND ${extraPredicates.join(' AND ')}` : '';
  const refundClause = options.refundOnly
    ? `AND IFNULL(transaction_type, '') = 'REFUND'`
    : `AND IFNULL(transaction_type, '') <> 'REFUND'`;

  const sql = `
    WITH latest_status AS (
      SELECT
        transaction_id,
        -- transaction_status.status is the numeric FK that references
        -- aggregator_order_status_mapper.id. Per V2 query shape.
        status AS status_code,
        ROW_NUMBER() OVER (PARTITION BY transaction_id ORDER BY id DESC) AS rn
      FROM ${Z}.dbe_transaction_status
      WHERE DATE(created_on) BETWEEN @from AND @to
    ),
    joined AS (
      SELECT
        t.id AS transaction_id,
        t.amount,
        t.refunded_amount,
        t.created_on,
        t.aggregator_id,
        t.payment_mode,
        t.payment_mode_identifier,
        t.transaction_type,
        t.merchant_profile_id,
        agg_map.status AS unified_status,
        agg_map.aggregator_status AS raw_aggregator_status,
        m.id AS seller_id,
        m.name AS brand_name,
        mp.name AS profile_name,
        agg.name AS aggregator_name,
        -- dbe_transaction has no meta column in Zenith (Boltic transformation dropped it);
        -- failures panel falls back to raw_aggregator_status only.
        CAST(NULL AS STRING) AS error_code,
        CAST(NULL AS STRING) AS error_reason,
        CAST(NULL AS STRING) AS error_description
      FROM ${Z}.dbe_transaction t
      LEFT JOIN latest_status ls
        ON ls.transaction_id = t.id AND ls.rn = 1
      LEFT JOIN ${Z}.dbe_aggregator_order_status_mapper agg_map
        ON agg_map.id = ls.status_code
      LEFT JOIN ${Z}.dbe_aggregator agg
        ON agg.aggregator_id = t.aggregator_id
      LEFT JOIN ${Z}.dbe_merchant_profile mp
        ON mp.id = t.merchant_profile_id
      LEFT JOIN ${Z}.dbe_merchant m
        ON m.id = mp.merchant_id
      ${ordersJoinSql}
      WHERE DATE(t.created_on) BETWEEN @from AND @to
        AND t.is_active = TRUE
        ${extraClause}
    ),
    slice AS (
      SELECT *
      FROM joined
      WHERE LOWER(IFNULL(brand_name, '')) NOT LIKE '%test%'
        AND IFNULL(aggregator_name, '') <> 'Openapi'
        AND IFNULL(payment_mode, '') <> 'PAYMENTLINK'
        ${refundClause}
    )
  `;

  return { sql, params, types };
}

/**
 * MOP normalization expression for use in SQL. Mirrors lib/mop.ts's RAW_TO_CANONICAL
 * + collapses Paytm/GPay/PhonePe aliases. Operates on `payment_mode_identifier`.
 */
export const SQL_MOP_NORMALIZE = `
  CASE
    WHEN payment_mode_identifier IN ('पेटीएम', 'Paytm', 'paytm', 'પેટીએમ') THEN 'Paytm'
    WHEN payment_mode_identifier IN ('GPay', 'google_pay') THEN 'GPay'
    WHEN payment_mode_identifier IN ('phonepe', 'PhonePe') THEN 'PhonePe'
    ELSE COALESCE(payment_mode_identifier, payment_mode)
  END
`;
