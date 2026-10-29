import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiskBadge } from '@/components/ui/Badges';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import type { RiskLevel } from '@/domain/types';
import { categoryColor, RISK_LABEL, RISK_ORDER } from '@/lib/colors';
import { qty } from '@/lib/format';
import { matchesFilters } from '@/store/hooks';
import { useStore } from '@/store/StoreProvider';

/** Búsqueda global con resultados instantáneos y filtros avanzados (categoría y nivel de riesgo). */
export function GlobalSearch() {
  const { state, dispatch, insights, categories, categoryById } = useStore();
  const { filters, products } = state;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => products.filter((p) => matchesFilters(p, insights[p.id], filters, categoryById[p.categoryId]?.name)),
    [products, insights, filters, categoryById],
  );
  const activeFilters = (filters.categoryId !== 'all' ? 1 : 0) + (filters.risk !== 'all' ? 1 : 0);
  const showResults = open && filters.query.trim() !== '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFiltersOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  const goTo = (id: string) => {
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/analisis?p=${id}`);
  };

  const top = results.slice(0, 7);

  return (
    <div ref={boxRef} className="relative flex w-full min-w-0 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={filters.query}
          placeholder="Buscar producto, SKU, código o pasillo…"
          aria-label="Búsqueda global"
          className="input h-10 pl-9 pr-9"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            dispatch({ type: 'SET_FILTERS', patch: { query: e.target.value } });
            setOpen(true);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, top.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter' && top[cursor]) {
              goTo(top[cursor].id);
            } else if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
        />
        {filters.query ? (
          <button
            onClick={() => dispatch({ type: 'SET_FILTERS', patch: { query: '' } })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink"
            aria-label="Limpiar búsqueda"
          >
            <X size={15} />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-faint md:block">/</kbd>
        )}

        {showResults && (
          <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-line" role="listbox">
            {top.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Sin coincidencias con los filtros actuales.</p>
            ) : (
              top.map((p, idx) => {
                const i = insights[p.id];
                return (
                  <button
                    key={p.id}
                    role="option"
                    aria-selected={idx === cursor}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => goTo(p.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${idx === cursor ? 'bg-page' : ''}`}
                  >
                    <ProductAvatar product={p} category={categoryById[p.categoryId]} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {categoryById[p.categoryId]?.name} · G {qty(p.stockGondola, p.unit)} · A {qty(p.stockAlmacen, p.unit)}
                      </span>
                    </span>
                    {i && <RiskBadge risk={i.risk} size="xs" />}
                  </button>
                );
              })
            )}
            <button
              onClick={() => {
                setOpen(false);
                navigate('/productos');
              }}
              className="w-full border-t border-line px-4 py-2.5 text-left text-xs font-semibold text-ink hover:bg-page"
            >
              Ver los {results.length} resultados en el catálogo →
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`btn-outline h-10 px-3 ${activeFilters ? 'border-ink' : ''}`}
          aria-expanded={filtersOpen}
          aria-label="Filtros avanzados"
        >
          <SlidersHorizontal size={16} aria-hidden />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && <span className="num rounded-full bg-ink px-1.5 text-[11px] leading-5 text-white">{activeFilters}</span>}
        </button>
        {filtersOpen && (
          <div className="absolute right-0 top-12 z-50 w-[min(92vw,340px)] rounded-xl bg-white p-4 shadow-pop ring-1 ring-line">
            <p className="mb-2 text-xs font-semibold text-muted">Categoría</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={filters.categoryId === 'all'} onClick={() => dispatch({ type: 'SET_FILTERS', patch: { categoryId: 'all' } })}>
                Todas
              </FilterChip>
              {categories.map((c) => (
                <FilterChip key={c.id} active={filters.categoryId === c.id} color={categoryColor(c.colorSlot)} onClick={() => dispatch({ type: 'SET_FILTERS', patch: { categoryId: c.id } })}>
                  {c.emoji} {c.name}
                </FilterChip>
              ))}
            </div>
            <p className="mb-2 mt-4 text-xs font-semibold text-muted">Riesgo de desabastecimiento</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={filters.risk === 'all'} onClick={() => dispatch({ type: 'SET_FILTERS', patch: { risk: 'all' } })}>
                Todos
              </FilterChip>
              {RISK_ORDER.map((r: RiskLevel) => (
                <FilterChip key={r} active={filters.risk === r} onClick={() => dispatch({ type: 'SET_FILTERS', patch: { risk: r } })}>
                  {RISK_LABEL[r]}
                </FilterChip>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <span className="text-xs text-muted">{results.length} productos coinciden</span>
              <button onClick={() => dispatch({ type: 'SET_FILTERS', patch: { query: '', categoryId: 'all', risk: 'all' } })} className="text-xs font-semibold text-brand-dark hover:underline">
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function FilterChip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`chip ${active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40'}`}
    >
      {color && !active && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  );
}
