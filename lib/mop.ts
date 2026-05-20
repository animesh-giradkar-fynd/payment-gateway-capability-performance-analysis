/**
 * MOP normalization rules per main-content.md.
 * Source: V2 query CASE statements + Gringotts constants.py taxonomy.
 *
 * Two layers:
 *   1. normalizeMOP() — raw → canonical identifier (e.g., 'पेटीएम' → 'Paytm'). Used at the
 *      BQ-query layer when grouping by `payment_mode_identifier`.
 *   2. displayMOPLabel() — canonical → human label (e.g., 'CARD' → 'Cards'). Used in the UI.
 */

const RAW_TO_CANONICAL: Record<string, string> = {
  // Paytm aliases (Hindi, Marathi, Gujarati scripts) per V2 query
  'पेटीएम': 'Paytm',
  'Paytm': 'Paytm',
  'paytm': 'Paytm',
  'પેટીએમ': 'Paytm',
  // GPay aliases
  'GPay': 'GPay',
  'google_pay': 'GPay',
  // PhonePe aliases
  'phonepe': 'PhonePe',
  'PhonePe': 'PhonePe',
};

export function normalizeMOP(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  return RAW_TO_CANONICAL[raw] ?? raw;
}

const DISPLAY_LABELS: Record<string, string> = {
  // Online
  CARD: 'Cards',
  NB: 'Netbanking',
  WL: 'Wallets',
  UPI: 'UPI',
  QR: 'QR',
  cardless_emi: 'Cardless EMI',
  // BNPL
  PL: 'BNPL (generic)',
  SIMPL: 'Simpl',
  ICIC: 'ICICI BNPL',
  HDFC: 'HDFC BNPL',
  PAYFLEX: 'Payflex',
  FLOAT: 'Float',
  // Offline
  CAS: 'Cash at store',
  CSAS: 'Cash at store',
  COD: 'Cash on delivery',
  UPIAS: 'UPI at store',
  // Multi-tender
  CASHBACK: 'Cashback',
  LOYALTY: 'Loyalty points',
  GFTCRD: 'Gift card',
  STORE_CREDIT: 'Store credit',
  UDHAARI: 'Udhaari',
  FC: 'Fynd Cash',
  OP: 'Offer',
  CREDITNOTE: 'Credit note',
};

export function displayMOPLabel(mop: string): string {
  return DISPLAY_LABELS[mop] ?? mop;
}

/** Group labels for the MOP filter dropdown (per main-content.md). */
export const MOP_GROUPS = {
  Online: ['CARD', 'NB', 'WL', 'UPI', 'QR', 'cardless_emi'],
  BNPL: ['PL', 'SIMPL', 'ICIC', 'HDFC', 'PAYFLEX', 'FLOAT'],
  Offline: ['CAS', 'CSAS', 'COD', 'UPIAS'],
  'Multi-tender': ['CASHBACK', 'LOYALTY', 'GFTCRD', 'STORE_CREDIT', 'UDHAARI', 'FC', 'OP', 'CREDITNOTE'],
} as const;
