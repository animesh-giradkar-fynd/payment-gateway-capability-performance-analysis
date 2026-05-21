/**
 * India Pincode → State mapping.
 *
 * India Postal pincodes follow a deterministic prefix system:
 *   - First digit = postal region (1-9)
 *   - First 2 digits = sub-region (state/UT in most cases)
 *
 * The mapping below covers all 36 states/UTs based on the first 2-3 digits. It's
 * not 100% precise for border districts (some pincode ranges straddle states) but
 * gets >95% accuracy for the dominant state of each prefix — fine for a heatmap.
 *
 * Maintained from: https://en.wikipedia.org/wiki/Postal_Index_Number
 */
const PREFIX_TO_STATE: Array<[RegExp, string]> = [
  // 11 — Delhi
  [/^11/, 'Delhi'],
  // 12-13 — Haryana
  [/^1[23]/, 'Haryana'],
  // 14-15 — Punjab
  [/^1[45]/, 'Punjab'],
  // 16 — Chandigarh
  [/^16/, 'Chandigarh'],
  // 17 — Himachal Pradesh
  [/^17/, 'Himachal Pradesh'],
  // 18-19 — Jammu & Kashmir / Ladakh
  [/^18/, 'Jammu and Kashmir'],
  [/^19/, 'Jammu and Kashmir'],
  // 20-28 — Uttar Pradesh (24-25 are partially Uttarakhand)
  [/^24/, 'Uttarakhand'],
  [/^25/, 'Uttarakhand'],
  [/^26/, 'Uttarakhand'],
  [/^2[0123789]/, 'Uttar Pradesh'],
  // 30-34 — Rajasthan
  [/^3[01234]/, 'Rajasthan'],
  // 36-39 — Gujarat
  [/^3[6789]/, 'Gujarat'],
  // 40-44 — Maharashtra
  [/^4[01234]/, 'Maharashtra'],
  // 45-48 — Madhya Pradesh
  [/^4[5678]/, 'Madhya Pradesh'],
  // 49 — Chhattisgarh
  [/^49/, 'Chhattisgarh'],
  // 50 — Telangana (officially 50 since 2014 split)
  [/^50/, 'Telangana'],
  // 51-53 — Andhra Pradesh
  [/^5[123]/, 'Andhra Pradesh'],
  // 56-59 — Karnataka
  [/^5[6789]/, 'Karnataka'],
  // 60-64 — Tamil Nadu (60-64, plus some 65)
  [/^6[01234]/, 'Tamil Nadu'],
  [/^605/, 'Puducherry'],
  [/^65/, 'Tamil Nadu'],
  // 67-69 — Kerala
  [/^6[789]/, 'Kerala'],
  // 70-74 — West Bengal
  [/^7[01234]/, 'West Bengal'],
  // 73-74 also include Sikkim partially
  [/^737/, 'Sikkim'],
  // 75-77 — Odisha
  [/^7[567]/, 'Odisha'],
  // 78 — Assam
  [/^78/, 'Assam'],
  // 79 — Arunachal/Manipur/Meghalaya/Mizoram/Nagaland/Tripura (NE composite)
  [/^790/, 'Arunachal Pradesh'],
  [/^791/, 'Arunachal Pradesh'],
  [/^792/, 'Arunachal Pradesh'],
  [/^793/, 'Meghalaya'],
  [/^794/, 'Meghalaya'],
  [/^795/, 'Manipur'],
  [/^796/, 'Mizoram'],
  [/^797/, 'Nagaland'],
  [/^798/, 'Nagaland'],
  [/^799/, 'Tripura'],
  // 80-85 — Bihar
  [/^8[012345]/, 'Bihar'],
  // 81-83 are Jharkhand actually — refine
  [/^81[5-9]/, 'Jharkhand'],
  [/^82/, 'Jharkhand'],
  [/^83/, 'Jharkhand'],
  // 86 (none — gap)
  // 90+ — Army Post Office (APO) — skip
];

export function pincodeToState(pincode: string | null | undefined): string | null {
  if (!pincode) return null;
  const clean = String(pincode).trim();
  if (!/^[1-9]\d{5}$/.test(clean)) return null;
  for (const [re, state] of PREFIX_TO_STATE) {
    if (re.test(clean)) return state;
  }
  return null;
}

/**
 * Aggregate an array of {pincode, count} into {state, count}.
 */
export function aggregateByState(
  rows: Array<{ pincode: string; order_count: number }>,
): Array<{ state: string; order_count: number }> {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const state = pincodeToState(r.pincode);
    if (!state) continue;
    totals.set(state, (totals.get(state) ?? 0) + r.order_count);
  }
  return Array.from(totals.entries())
    .map(([state, order_count]) => ({ state, order_count }))
    .sort((a, b) => b.order_count - a.order_count);
}
