import { useMemo } from 'react';
import type { GlobalFilters, Product } from '@/domain/types';
import type { ProductInsight } from '@/engine/inventory';
import { useStore } from './StoreProvider';

/** Normaliza texto para búsquedas sin tildes ni mayúsculas. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function matchesFilters(p: Product, i: ProductInsight | undefined, f: GlobalFilters, categoryName = ''): boolean {
  if (f.categoryId !== 'all' && p.categoryId !== f.categoryId) return false;
  if (f.risk !== 'all' && i?.risk !== f.risk) return false;
  const q = normalize(f.query.trim());
  if (!q) return true;
  const hay = normalize(`${p.name} ${p.sku} ${p.barcode} ${p.location} ${categoryName}`);
  return q.split(/\s+/).every((t) => hay.includes(t));
}

/** Productos que cumplen la búsqueda global y los filtros avanzados. */
export function useFilteredProducts(): Product[] {
  const { state, insights, categoryById } = useStore();
  const { products, filters } = state;
  return useMemo(
    () => products.filter((p) => matchesFilters(p, insights[p.id], filters, categoryById[p.categoryId]?.name)),
    [products, insights, filters, categoryById],
  );
}

export function useFiltersActive(): boolean {
  const { filters } = useStore().state;
  return filters.query.trim() !== '' || filters.categoryId !== 'all' || filters.risk !== 'all';
}
