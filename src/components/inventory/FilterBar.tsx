import { X } from 'lucide-react';
import { FilterChip } from '@/components/layout/GlobalSearch';
import { RiskDot } from '@/components/ui/Badges';
import { categoryColor, RISK_LABEL, RISK_ORDER } from '@/lib/colors';
import { useStore } from '@/store/StoreProvider';

/** Filtros rápidos (categoría + riesgo) enlazados al estado global de búsqueda. */
export function FilterBar({ count, total }: { count: number; total: number }) {
  const { state, dispatch, categories, insights } = useStore();
  const { filters } = state;
  const riskCounts = RISK_ORDER.map((r) => ({ r, n: state.products.filter((p) => insights[p.id]?.risk === r && (filters.categoryId === 'all' || p.categoryId === filters.categoryId)).length }));
  const any = filters.query.trim() !== '' || filters.categoryId !== 'all' || filters.risk !== 'all';
  return (
    <div className="mb-4 space-y-2">
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        <FilterChip active={filters.categoryId === 'all'} onClick={() => dispatch({ type: 'SET_FILTERS', patch: { categoryId: 'all' } })}>
          Todas las categorías
        </FilterChip>
        {categories.map((c) => (
          <FilterChip key={c.id} active={filters.categoryId === c.id} color={categoryColor(c.colorSlot)} onClick={() => dispatch({ type: 'SET_FILTERS', patch: { categoryId: filters.categoryId === c.id ? 'all' : c.id } })}>
            {c.emoji} {c.name}
          </FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-muted">Riesgo:</span>
        {riskCounts.map(({ r, n }) => (
          <button
            key={r}
            onClick={() => dispatch({ type: 'SET_FILTERS', patch: { risk: filters.risk === r ? 'all' : r } })}
            aria-pressed={filters.risk === r}
            className={`chip ${filters.risk === r ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40'}`}
          >
            <RiskDot risk={r} /> {RISK_LABEL[r]} <span className="num opacity-60">{n}</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">
          {count} de {total} productos
          {filters.query.trim() && (
            <>
              {' '}
              para «<strong className="text-ink">{filters.query.trim()}</strong>»
            </>
          )}
        </span>
        {any && (
          <button onClick={() => dispatch({ type: 'SET_FILTERS', patch: { query: '', categoryId: 'all', risk: 'all' } })} className="chip border-transparent text-brand-dark hover:underline">
            <X size={12} aria-hidden /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
