import type { DashboardFilters } from '@/lib/filters';
import { buildSliceCTE, SQL_MOP_NORMALIZE, type BQQuery } from '@/lib/bq/templates/base';

export type MopMixRow = {
  payment_mode: string;
  normalized_mop_identifier: string | null;
  transaction_count: number;
  share_pct: number;
};

/**
 * MOP mix — share of volume per payment mode in the current slice.
 *
 * Two grain options exist:
 *   (a) `payment_mode` — the raw code from transaction (CARD, UPI, NB, WL, etc.) —
 *       maps cleanly to PRD F1#7 MOP filter and main-content.md display labels.
 *   (b) `payment_mode_identifier` — finer-grained (specific wallet like 'paytm' / 'PhonePe' /
 *       'google_pay' / etc.) — useful for the doughnut's "what wallet won this slice" detail.
 *
 * Returns both so the UI can pivot between them. SQL-side MOP normalization is applied so
 * Hindi/Marathi/Gujarati Paytm script aliases collapse, etc.
 */
export function mopMixQuery(filters: DashboardFilters): BQQuery {
  const slice = buildSliceCTE(filters);

  const query = `
    ${slice.sql}
    , totals AS (SELECT COUNT(*) AS total FROM slice)
    SELECT
      COALESCE(payment_mode, '(unknown)') AS payment_mode,
      ${SQL_MOP_NORMALIZE} AS normalized_mop_identifier,
      COUNT(*) AS transaction_count,
      SAFE_DIVIDE(COUNT(*), (SELECT total FROM totals)) * 100 AS share_pct
    FROM slice
    GROUP BY payment_mode, normalized_mop_identifier
    ORDER BY transaction_count DESC
    LIMIT 50
  `;

  return { query, params: slice.params, types: slice.types };
}
