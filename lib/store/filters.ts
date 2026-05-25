'use client';
import { create } from 'zustand';
import type { DashboardFilters } from '@/lib/filters';
import { lastNDays } from '@/lib/filters';

interface FilterStore {
  filters: DashboardFilters;
  /** Replace the entire filter object. Used by URL sync on mount. */
  setAll: (next: DashboardFilters) => void;
  /** Patch one or more fields. */
  patch: (partial: Partial<DashboardFilters>) => void;
  /** Reset to defaults (last 30 days, India, no PG/MOP/etc. filters). */
  reset: () => void;
}

const initial: DashboardFilters = {
  dateRange: lastNDays(30),
  country: 'IN',
};

export const useFilterStore = create<FilterStore>((set) => ({
  filters: initial,
  setAll: (next) => set({ filters: next }),
  patch: (partial) =>
    set((s) => ({
      filters: { ...s.filters, ...partial, dateRange: partial.dateRange ?? s.filters.dateRange },
    })),
  reset: () => set({ filters: initial }),
}));
