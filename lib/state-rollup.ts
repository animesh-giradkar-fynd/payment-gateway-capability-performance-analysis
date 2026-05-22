/**
 * Indian-state canonicalization + per-state MOP rollup for the Regional panel.
 *
 * `delivery_state` on dbe_shipments is free-text ("MAHARASHTRA", "West Bengal",
 * "Jammu and Kashmir", plus non-India values like "Selangor"). This module folds it
 * to a canonical name that matches the India TopoJSON's `ST_NM` values, drops
 * anything that isn't one of the 36 Indian states/UTs, and rolls the rows up to a
 * per-state payment-method breakdown.
 */
import { mopGroupFor, MOP_GROUP_ORDER, type MopGroup } from '@/lib/normalizations';

/**
 * Normalize a state name to a comparison key: '&'→'and', drop the 'NCT of' prefix,
 * fix the common 'Arunanchal' misspelling, then strip everything but letters.
 * Used both to canonicalize raw `delivery_state` and to match the TopoJSON's ST_NM.
 */
export function stateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bnct of\b/g, '')
    .replace(/arunanchal/g, 'arunachal')
    .replace(/[^a-z]/g, '');
}

/**
 * Canonical state/UT names — these are the exact `ST_NM` values in the India
 * TopoJSON, so a rolled-up state always lines up with a map shape.
 */
export const CANONICAL_STATES: string[] = [
  'Andaman & Nicobar', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand',
  'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
];

// Free-text variants that don't key-match a canonical name on their own.
const ALIASES: Record<string, string> = {
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  newdelhi: 'Delhi',
  uttaranchal: 'Uttarakhand',
  damananddiu: 'Dadra and Nagar Haveli and Daman and Diu',
  dadraandnagarhaveli: 'Dadra and Nagar Haveli and Daman and Diu',
  andamanandnicobarislands: 'Andaman & Nicobar',
};

const KEY_TO_CANONICAL: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const name of CANONICAL_STATES) m.set(stateKey(name), name);
  for (const [k, v] of Object.entries(ALIASES)) m.set(k, v);
  return m;
})();

/** Free-text `delivery_state` → canonical Indian state, or null if not an Indian state. */
export function canonicalizeState(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = stateKey(raw);
  if (!k) return null;
  return KEY_TO_CANONICAL.get(k) ?? null;
}

/** Per-state payment-method rollup — one entry per Indian state with order volume. */
export type StateMopRollup = {
  state: string;
  total: number;
  breakdown: Record<MopGroup, number>;
};

export function emptyBreakdown(): Record<MopGroup, number> {
  return {
    UPI: 0, Cards: 0, Wallets: 0, 'Net banking': 0,
    'BNPL/EMI': 0, COD: 0, 'Tap-to-pay': 0, Other: 0,
  };
}

/**
 * Roll flat {delivery_state, payment_mode, order_count} rows up to per-state MOP
 * breakdowns. Non-Indian / unrecognized states are dropped. Sorted by total desc.
 */
export function rollupStateMop(
  rows: Array<{ delivery_state: string; payment_mode: string; order_count: number }>,
): StateMopRollup[] {
  const byState = new Map<string, Record<MopGroup, number>>();
  for (const r of rows) {
    const state = canonicalizeState(r.delivery_state);
    if (!state) continue;
    let bd = byState.get(state);
    if (!bd) {
      bd = emptyBreakdown();
      byState.set(state, bd);
    }
    bd[mopGroupFor(r.payment_mode)] += r.order_count;
  }

  return Array.from(byState.entries())
    .map(([state, breakdown]) => {
      let total = 0;
      for (const g of MOP_GROUP_ORDER) total += breakdown[g];
      return { state, total, breakdown };
    })
    .sort((a, b) => b.total - a.total);
}
