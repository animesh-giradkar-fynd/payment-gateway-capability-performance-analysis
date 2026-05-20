import { z } from 'zod';

/**
 * Canonical dashboard filter envelope. Used as the JSON body shape for every
 * /api/* route. Validated with Zod so malformed input never reaches BigQuery.
 */
export const FilterSchema = z.object({
  dateRange: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  }),
  compareToPreviousPeriod: z.boolean().default(false),
  country: z.literal('IN').default('IN'),
  orderingChannel: z.array(z.string()).optional(),
  merchantProfileIds: z.array(z.number().int()).optional(),
  sellerIds: z.array(z.number().int()).optional(),
  aggregatorIds: z.array(z.number().int()).optional(),
  paymentModes: z.array(z.string()).optional(),
});

export type DashboardFilters = z.infer<typeof FilterSchema>;

export function parseFilters(input: unknown): DashboardFilters {
  return FilterSchema.parse(input);
}

/** URL ↔ filter helpers — used by the dashboard page for permalink support. */
export function filtersToSearchParams(f: DashboardFilters): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set('from', f.dateRange.from);
  sp.set('to', f.dateRange.to);
  if (f.compareToPreviousPeriod) sp.set('compare', '1');
  if (f.orderingChannel?.length) sp.set('channel', f.orderingChannel.join(','));
  if (f.merchantProfileIds?.length) sp.set('profile', f.merchantProfileIds.join(','));
  if (f.sellerIds?.length) sp.set('seller', f.sellerIds.join(','));
  if (f.aggregatorIds?.length) sp.set('pg', f.aggregatorIds.join(','));
  if (f.paymentModes?.length) sp.set('mop', f.paymentModes.join(','));
  return sp;
}

export function filtersFromSearchParams(sp: URLSearchParams): DashboardFilters {
  const fallback = lastNDays(30);
  return parseFilters({
    dateRange: {
      from: sp.get('from') ?? fallback.from,
      to: sp.get('to') ?? fallback.to,
    },
    compareToPreviousPeriod: sp.get('compare') === '1',
    country: 'IN',
    orderingChannel: sp.get('channel')?.split(',').filter(Boolean),
    merchantProfileIds: sp.get('profile')?.split(',').map(Number).filter((n) => Number.isFinite(n)),
    sellerIds: sp.get('seller')?.split(',').map(Number).filter((n) => Number.isFinite(n)),
    aggregatorIds: sp.get('pg')?.split(',').map(Number).filter((n) => Number.isFinite(n)),
    paymentModes: sp.get('mop')?.split(',').filter(Boolean),
  });
}

export function lastNDays(n: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - n);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(from), to: fmt(to) };
}

/** Cache key for the route-handler cache layer. Stable across permutations of the same filter. */
export function filterCacheKey(f: DashboardFilters): string {
  return JSON.stringify({
    d: [f.dateRange.from, f.dateRange.to],
    c: f.compareToPreviousPeriod ? 1 : 0,
    co: f.country,
    oc: [...(f.orderingChannel ?? [])].sort(),
    mp: [...(f.merchantProfileIds ?? [])].sort(),
    s: [...(f.sellerIds ?? [])].sort(),
    a: [...(f.aggregatorIds ?? [])].sort(),
    pm: [...(f.paymentModes ?? [])].sort(),
  });
}
