/**
 * Canonical per-gateway display name + colour.
 *
 * Every PG-comparing panel imports these so a gateway always renders with the same
 * label and the same colour, no matter which panel it appears in. Fixes the audit
 * findings A5 (Razorpay was blue in one panel, magenta in another) and A6 (raw casing
 * like "Ccavenue" vs "CCAvenue").
 *
 * Keyed on the lowercased raw `aggregator.name` coming back from BigQuery.
 */

const DISPLAY_NAME: Record<string, string> = {
  'razorpay': 'Razorpay',
  'razorpay magic checkout': 'Razorpay Magic Checkout',
  'juspay': 'Juspay',
  'cashfree': 'Cashfree',
  'ccavenue': 'CCAvenue',
  'payu money': 'PayU Money',
  'payumoney': 'PayU Money',
  'pine labs': 'Pine Labs',
  'pinelabs': 'Pine Labs',
  'simpl': 'Simpl',
  'jioonepay': 'JioOnePay',
  'checkout': 'Checkout',
};

/** Raw `aggregator.name` → clean display label (fixes casing inconsistencies). */
export function displayGatewayName(raw: string | null | undefined): string {
  if (!raw) return '(unknown)';
  const key = raw.trim().toLowerCase();
  return DISPLAY_NAME[key] ?? raw.trim();
}

// Fixed hue per known gateway — stable across every panel.
const GATEWAY_COLOR: Record<string, string> = {
  'razorpay': '#1e6abf',                 // blue
  'razorpay magic checkout': '#3b82f6',  // lighter blue — kin of Razorpay
  'juspay': '#0d8a5a',                   // green
  'cashfree': '#0891b2',                 // cyan
  'ccavenue': '#b45309',                 // amber
  'payu money': '#6d28d9',               // violet
  'payumoney': '#6d28d9',
  'pine labs': '#be185d',                // pink
  'pinelabs': '#be185d',
  'simpl': '#3730a3',                    // indigo
  'jioonepay': '#dc2626',                // red
  'checkout': '#6b7280',                 // grey
};

// Deterministic fallback so an unknown gateway still maps to a stable colour.
const FALLBACK_PALETTE = ['#15803d', '#9333ea', '#0c4a6e', '#a3194f', '#7c2d12', '#1d4ed8'];

/** Raw `aggregator.name` → a stable colour (same name → same colour, always). */
export function gatewayColor(raw: string | null | undefined): string {
  if (!raw) return '#9ca3af';
  const key = raw.trim().toLowerCase();
  if (GATEWAY_COLOR[key]) return GATEWAY_COLOR[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}
