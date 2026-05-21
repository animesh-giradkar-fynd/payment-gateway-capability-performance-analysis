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
  /**
   * If true, includes the internal `Fynd` aggregator in the slice. Used by the Offline MOP
   * panel (COD / Cash-at-store / UPI-at-store) which lives entirely under the Fynd handler.
   * All other exclusions (test/UAT/dev/sandbox + the other internal handlers like CreditNote)
   * still apply.
   */
  includeOfflineHandler?: boolean;
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
    from: 'STRING',
    to: 'STRING',
  };

  // Conditional filter predicates — only emitted when the array is non-empty.
  // BQ's IN UNNEST(@arr) on an empty array would return false for every row, so
  // omitting the predicate entirely is the "no filter" path.
  const extraPredicates: string[] = [];

  // NOTE on the CAST(... AS INT64) wrappers below — every numeric-ID column in Zenith
  // (dbe_transaction.aggregator_id, dbe_transaction.merchant_profile_id,
  // dbe_merchant.merchant_id) is BIGNUMERIC, but the wire params are INT64 arrays. Without
  // the cast, BQ raises "No matching signature for operator IN UNNEST" and every panel
  // 500s the moment a PG / Profile / Seller filter is selected. Cast at the column side
  // keeps the param contract clean (callers still pass plain numbers).
  if (filters.aggregatorIds?.length) {
    extraPredicates.push('CAST(t.aggregator_id AS INT64) IN UNNEST(@aggregatorIds)');
    params.aggregatorIds = filters.aggregatorIds;
    types.aggregatorIds = ['INT64'];
  }
  if (filters.paymentModes?.length) {
    extraPredicates.push('t.payment_mode IN UNNEST(@paymentModes)');
    params.paymentModes = filters.paymentModes;
    types.paymentModes = ['STRING'];
  }
  if (filters.merchantProfileIds?.length) {
    extraPredicates.push('CAST(t.merchant_profile_id AS INT64) IN UNNEST(@merchantProfileIds)');
    params.merchantProfileIds = filters.merchantProfileIds;
    types.merchantProfileIds = ['INT64'];
  }
  if (filters.sellerIds?.length) {
    // FC Seller filter — sellerIds are merchant.id (the brand), so we filter via the
    // merchant_profile → merchant join chain. mp.merchant_id is the FK on merchant_profile.
    extraPredicates.push('CAST(mp.merchant_id AS INT64) IN UNNEST(@sellerIds)');
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

  // Aggregator exclusion list — `fynd` is dropped when includeOfflineHandler=true so the
  // Offline MOP panel can read the Fynd-managed slice (COD / Cash-at-store / UPI-at-store).
  // Every other handler stays excluded regardless of the flag.
  const internalHandlers = options.includeOfflineHandler
    ? ['creditnote', 'store credits', 'credit', 'openapi', 'payment-fahim', 'asmakhanextprod']
    : ['fynd', 'creditnote', 'store credits', 'credit', 'openapi', 'payment-fahim', 'asmakhanextprod'];
  const internalHandlersSqlList = internalHandlers.map((n) => `'${n}'`).join(', ');

  const sql = `
    WITH latest_status AS (
      SELECT
        transaction_id,
        -- transaction_status.status is the numeric FK that references
        -- aggregator_order_status_mapper.id. Per V2 query shape.
        status AS status_code,
        ROW_NUMBER() OVER (PARTITION BY transaction_id ORDER BY id DESC) AS rn
      FROM ${Z}.dbe_transaction_status
      WHERE DATE(created_on) BETWEEN DATE(@from) AND DATE(@to)
    ),
    -- dbe_aggregator has duplicate aggregator_id rows (~20 IDs including Razorpay
    -- and Jioonepay) — joining directly would fan out counts 2×. Dedupe to one
    -- canonical name per id, preferring longer names so placeholder single-char
    -- rows (e.g. 'd' for Razorpay Magic Checkout id=195) lose to the real label.
    aggregator_dedup AS (
      SELECT aggregator_id, name
      FROM (
        SELECT aggregator_id, name,
               ROW_NUMBER() OVER (
                 PARTITION BY aggregator_id
                 ORDER BY LENGTH(name) DESC NULLS LAST, modified_on DESC NULLS LAST
               ) AS rn
        FROM ${Z}.dbe_aggregator
      )
      WHERE rn = 1
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
      LEFT JOIN aggregator_dedup agg
        ON agg.aggregator_id = t.aggregator_id
      LEFT JOIN ${Z}.dbe_merchant_profile mp
        ON mp.id = t.merchant_profile_id
      LEFT JOIN ${Z}.dbe_merchant m
        ON m.id = mp.merchant_id
      ${ordersJoinSql}
      WHERE DATE(t.created_on) BETWEEN DATE(@from) AND DATE(@to)
        AND t.is_active = TRUE
        ${extraClause}
    ),
    slice AS (
      SELECT *
      FROM joined
      WHERE LOWER(IFNULL(brand_name, '')) NOT LIKE '%test%'
        -- Aggregator exclusion list. Built from the internalHandlers array above so
        -- the Offline MOP panel can opt back into 'fynd' via includeOfflineHandler=true.
        --   - 'fynd' is Fynd's internal offline handler (~91% COD/Cash/UPI-at-store).
        --     Excluded by default so PG panels compare only customer-facing gateways
        --     (Razorpay/Juspay/Cashfree/etc.); included by the Offline MOP slice.
        --   - 'creditnote', 'store credits', 'credit' are internal wallet/adjustment paths.
        --   - 'openapi' is the sandbox/test adapter.
        --   - 'payment-fahim', 'asmakhanextprod' are dev/personal aggregators.
        -- Patterns below catch generic test/uat/dev/sandbox naming.
        AND LOWER(IFNULL(aggregator_name, '')) NOT IN (${internalHandlersSqlList})
        AND LOWER(IFNULL(aggregator_name, '')) NOT LIKE '%test%'
        AND LOWER(IFNULL(aggregator_name, '')) NOT LIKE '%uat%'
        AND LOWER(IFNULL(aggregator_name, '')) NOT LIKE '%dev%'
        AND LOWER(IFNULL(aggregator_name, '')) NOT LIKE '%sandbox%'
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
