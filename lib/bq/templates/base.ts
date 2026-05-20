import type { DashboardFilters } from '@/lib/filters';

const PROJECT = process.env.BQ_PROJECT ?? 'fynd-jio-commerceml-prod';
const DATASET = process.env.BQ_DATASET ?? 'fynd_zenith_data';
export const Z = `\`${PROJECT}.${DATASET}\``;

export type BQQuery = {
  query: string;
  params: Record<string, unknown>;
  types: Record<string, string | string[]>;
};

/**
 * Reusable CTE that produces the base `slice` row set every telemetry panel queries against.
 * Encodes the V2 query shape (D007) translated to Zenith (D006):
 *   - Latest-status pattern via ROW_NUMBER() PARTITION BY transaction_id ORDER BY id DESC
 *   - LEFT JOINs: transaction → latest_status → aggregator_order_status_mapper → aggregator
 *                 → merchant_profile → merchant
 *   - Date-range constraint on both transaction.created_on and transaction_status.created_on
 *   - is_active = TRUE on transaction
 *   - Standard exclusions: test brands, Openapi, PAYMENTLINK, REFUND
 *   - Optional filters: aggregatorIds, paymentModes — applied conditionally
 *
 * The caller composes its own SELECT / GROUP BY on top of the `slice` CTE.
 */
export function buildSliceCTE(filters: DashboardFilters): {
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

  const extraClause = extraPredicates.length ? `AND ${extraPredicates.join(' AND ')}` : '';

  const sql = `
    WITH latest_status AS (
      SELECT
        transaction_id,
        id AS status_mapper_id,
        ROW_NUMBER() OVER (PARTITION BY transaction_id ORDER BY id DESC) AS rn
      FROM ${Z}.transaction_status
      WHERE DATE(created_on) BETWEEN @from AND @to
    ),
    joined AS (
      SELECT
        t.id AS transaction_id,
        t.amount,
        t.created_on,
        t.aggregator_id,
        t.payment_mode,
        t.payment_mode_identifier,
        t.transaction_type,
        t.merchant_profile_id,
        agg_map.status AS unified_status,
        m.name AS brand_name,
        agg.name AS aggregator_name
      FROM ${Z}.transaction t
      LEFT JOIN latest_status ls
        ON ls.transaction_id = t.id AND ls.rn = 1
      LEFT JOIN ${Z}.aggregator_order_status_mapper agg_map
        ON agg_map.id = ls.status_mapper_id
      LEFT JOIN ${Z}.aggregator agg
        ON agg.aggregator_id = t.aggregator_id
      LEFT JOIN ${Z}.merchant_profile mp
        ON mp.id = t.merchant_profile_id
      LEFT JOIN ${Z}.merchant m
        ON m.id = mp.merchant_id
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
        AND IFNULL(transaction_type, '') <> 'REFUND'
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
