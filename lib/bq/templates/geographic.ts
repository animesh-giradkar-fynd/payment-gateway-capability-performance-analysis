import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, type BQQuery } from '@/lib/bq/templates/base';

export type GeographicRow = {
  label: string;
  transaction_count: number;
  successful_count: number;
  share_pct: number;
};

/**
 * Geographic distribution (v0 fallback per PRD P1.4).
 *
 * The brief's spec calls for a state-level India heatmap, but the source column for state
 * data in Zenith is unverified (PRD Q3). Until that lands, this panel surfaces the top-10
 * storefronts (merchant_profile.name) by volume in the slice — a useful regional proxy
 * since most Fynd storefronts are regional brands. When PRD Q3 is resolved, this query is
 * replaced by a state-grouping query and the panel's Recharts bar is swapped for a
 * react-simple-maps choropleth.
 */
export function geographicQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters);

  const query = `
    ${slice.sql}
    , totals AS (SELECT COUNT(*) AS total FROM slice)
    SELECT
      COALESCE(profile_name, brand_name, '(unknown)') AS label,
      COUNT(*) AS transaction_count,
      COUNTIF(unified_status IN ('complete', 'completed', 'paid')) AS successful_count,
      SAFE_DIVIDE(COUNT(*), (SELECT total FROM totals)) * 100 AS share_pct
    FROM slice
    GROUP BY label
    ORDER BY transaction_count DESC
    LIMIT 10
  `;

  return { query, params: slice.params, types: slice.types };
}
