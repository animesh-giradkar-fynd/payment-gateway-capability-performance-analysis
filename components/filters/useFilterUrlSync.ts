'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFilterStore } from '@/lib/store/filters';
import { filtersFromSearchParams, filtersToSearchParams } from '@/lib/filters';

/**
 * Two-way URL ↔ store sync:
 *   - On mount, parse current URL search params into the store.
 *   - On store change, write the canonical params back to the URL (replace, not push).
 *
 * Must be called once at the top of the dashboard tree. Subsequent renders are no-ops
 * unless the filter shape actually changes.
 */
export function useFilterUrlSync() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useFilterStore((s) => s.filters);
  const setAll = useFilterStore((s) => s.setAll);
  const hydrated = useRef(false);

  // Hydrate from URL on mount
  useEffect(() => {
    if (hydrated.current) return;
    try {
      const fromUrl = filtersFromSearchParams(new URLSearchParams(sp.toString()));
      setAll(fromUrl);
    } catch {
      // Malformed URL — ignore, fall back to default store state.
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write back on filter change (skip the first run before hydration completes)
  useEffect(() => {
    if (!hydrated.current) return;
    const qs = filtersToSearchParams(filters).toString();
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }, [filters, pathname, router]);
}
