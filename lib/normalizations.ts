/**
 * Display-layer normalizations for MOP groups, refund methods, and failure reasons.
 * Keeping these in one place so the panel components stay focused on rendering and
 * the BQ templates stay focused on aggregation.
 */

/* ============================================================================
 * MOP MIX — group raw payment_mode codes into the 7 buckets shown in the brief
 * (UPI, Cards, Wallets, Net banking, BNPL/EMI, COD, Tap-to-pay)
 * ============================================================================ */
export type MopGroup =
  | 'UPI'
  | 'Cards'
  | 'Wallets'
  | 'Net banking'
  | 'BNPL/EMI'
  | 'COD'
  | 'Tap-to-pay'
  | 'Other';

/** Raw gringotts payment_mode → display bucket. */
export function mopGroupFor(rawPaymentMode: string | null | undefined): MopGroup {
  if (!rawPaymentMode) return 'Other';
  const m = rawPaymentMode.toUpperCase();
  if (m === 'UPI' || m === 'QR') return 'UPI';
  if (m === 'CARD') return 'Cards';
  if (m === 'WL') return 'Wallets';
  if (m === 'NB') return 'Net banking';
  if (m === 'COD' || m === 'CAS' || m === 'CSAS') return 'COD';
  if (m === 'UPIAS') return 'Tap-to-pay';
  if (
    m === 'PL' || m === 'SIMPL' || m === 'ICIC' || m === 'HDFC' ||
    m === 'PAYFLEX' || m === 'FLOAT' || m === 'CARDLESS_EMI' || m === 'CARD_EMI'
  ) return 'BNPL/EMI';
  return 'Other';
}

/** Stable display order for the doughnut legend (largest categories first). */
export const MOP_GROUP_ORDER: MopGroup[] = [
  'UPI', 'Cards', 'Wallets', 'Net banking', 'BNPL/EMI', 'COD', 'Tap-to-pay', 'Other',
];

/** Semantic-ish colors per bucket. */
export const MOP_GROUP_COLOR: Record<MopGroup, string> = {
  'UPI':         '#0d8a5a', // green — UPI dominant
  'Cards':       '#1e6abf', // blue
  'Wallets':     '#6d28d9', // violet
  'Net banking': '#b45309', // orange
  'BNPL/EMI':    '#be185d', // pink
  'COD':         '#6b7280', // grey
  'Tap-to-pay':  '#dc2626', // red
  'Other':       '#9ca3af', // light grey
};

/* ============================================================================
 * OFFLINE MOP MIX — Fynd-managed offline buckets (COD / Cash at store / UPI at store).
 * The online MopGroup above maps CAS/CSAS → 'COD' and UPIAS → 'Tap-to-pay' which works
 * fine when the slice is dominated by online PGs, but for the Fynd-only Offline panel
 * we want sharper labels so leadership can see the offline composition at a glance.
 * ============================================================================ */
export type OfflineMopGroup = 'COD' | 'Cash at store' | 'UPI at store' | 'Other';

/** Raw Fynd payment_mode → offline display bucket. */
export function offlineMopGroupFor(rawPaymentMode: string | null | undefined): OfflineMopGroup {
  if (!rawPaymentMode) return 'Other';
  const m = rawPaymentMode.toUpperCase();
  if (m === 'COD') return 'COD';
  if (m === 'CAS' || m === 'CSAS') return 'Cash at store';
  if (m === 'UPIAS') return 'UPI at store';
  return 'Other';
}

/** Stable display order for the Offline MOP doughnut. */
export const OFFLINE_MOP_GROUP_ORDER: OfflineMopGroup[] = [
  'COD', 'Cash at store', 'UPI at store', 'Other',
];

/** Earth-toned palette to differentiate the offline panel from the online one. */
export const OFFLINE_MOP_GROUP_COLOR: Record<OfflineMopGroup, string> = {
  'COD':           '#d97706', // amber-600 — dominant offline bucket
  'Cash at store': '#92400e', // amber-800
  'UPI at store':  '#0f766e', // teal-700
  'Other':         '#94a3b8', // slate-400
};

/* ============================================================================
 * REFUND POSTURE — categorize refunds by inferred method using payment_mode
 * (4 KPI tiles from the brief: Instant / Source / Store credit / Cash exchange)
 * ============================================================================ */
export type RefundMethod = 'Instant refund' | 'Source refund' | 'Store credit' | 'Cash / exchange';

export function refundMethodFor(rawPaymentMode: string | null | undefined): RefundMethod {
  const g = mopGroupFor(rawPaymentMode);
  switch (g) {
    case 'UPI':
      return 'Instant refund';        // UPI / IMPS rail
    case 'Cards':
    case 'Net banking':
      return 'Source refund';         // back to original card / netbank
    case 'Wallets':
    case 'BNPL/EMI':
      return 'Store credit';          // wallet rail / store credit
    case 'COD':
    case 'Tap-to-pay':
    case 'Other':
    default:
      return 'Cash / exchange';       // POS only
  }
}

export const REFUND_METHOD_ORDER: RefundMethod[] = [
  'Instant refund', 'Source refund', 'Store credit', 'Cash / exchange',
];

/** Helper text shown under each KPI value (matches the screenshot). */
export const REFUND_METHOD_DESCRIPTION: Record<RefundMethod, string> = {
  'Instant refund':  'UPI · IMPS rail',
  'Source refund':   'card / netbank',
  'Store credit':    'wallet rail',
  'Cash / exchange': 'POS only',
};

/* ============================================================================
 * FAILURE REASONS — normalize raw aggregator_status codes to friendly buckets.
 * Codes seen in Zenith (top 25): FAILED, BAD_REQUEST_ERROR, AUTHENTICATION_FAILED,
 * GATEWAY_ERROR, PENDING, CANCELLED, FAILURE, UNVERIFIED, AUTHORIZATION_FAILED,
 * SERVER_ERROR, UNSUCCESSFUL, VOID_FAILED, VOID_INITIATED, ABORTED, JUSPAY_DECLINED.
 * The mockup's labels (Insufficient funds, OTP timeout, etc.) come from issuer-level
 * codes that aggregators rarely surface; we map to the closest available category.
 * ============================================================================ */
export type FailureCategory =
  | 'Cancelled @ 2h (Fynd)'   // Fynd's internal 2h-timeout cancel — typically the largest bucket
  | 'Authentication failed'   // 3DS / OTP / auth failures
  | 'Issuer decline'           // generic decline by issuer
  | 'Gateway error'            // PG-side error
  | 'User abandoned'           // cancellation / abort
  | 'Verification failed'      // unverified, KYC, etc.
  | 'Network / timeout'        // server errors, timeouts
  | 'Refund / void issue'      // void failed / void initiated
  | 'Other';

const FAILURE_MAP: Record<string, FailureCategory> = {
  // Fynd 2h-timeout cancel — synthetic reason emitted by failuresQuery for
  // unified_status='pending' rows.
  '__FYND_2H_TIMEOUT__':    'Cancelled @ 2h (Fynd)',
  // Authentication failures (3DS, OTP)
  'AUTHENTICATION_FAILED':  'Authentication failed',
  'AUTHORIZATION_FAILED':   'Authentication failed',
  // Issuer declines
  'JUSPAY_DECLINED':        'Issuer decline',
  'BAD_REQUEST_ERROR':      'Issuer decline',
  // User abandoned
  'CANCELLED':              'User abandoned',
  'ABORTED':                'User abandoned',
  // Verification
  'UNVERIFIED':             'Verification failed',
  // Network / server
  'GATEWAY_ERROR':          'Gateway error',
  'SERVER_ERROR':           'Network / timeout',
  // Refund/void issues
  'VOID_FAILED':            'Refund / void issue',
  'VOID_INITIATED':         'Refund / void issue',
  // Generic — fall through
  'FAILED':                 'Other',
  'FAILURE':                'Other',
  'UNSUCCESSFUL':           'Other',
  'PENDING':                'Other',
  '1':                      'Other',
};

export function failureCategoryFor(code: string | null | undefined): FailureCategory {
  if (!code) return 'Other';
  return FAILURE_MAP[code.toUpperCase()] ?? 'Other';
}

export const FAILURE_CATEGORY_ORDER: FailureCategory[] = [
  'Cancelled @ 2h (Fynd)',
  'Authentication failed', 'Issuer decline', 'Gateway error',
  'User abandoned', 'Verification failed', 'Network / timeout',
  'Refund / void issue', 'Other',
];
