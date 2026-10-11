import { ArrowRightLeft, ChartLine, ClipboardList, Download, PackageMinus, PackagePlus, PackageSearch, Plus, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActions } from '@/components/inventory/ActionsProvider';
import { FilterBar } from '@/components/inventory/FilterBar';
import { gondolaWhen, stockoutWhen } from '@/components/inventory/labels';
import { PageHeader } from '@/components/layout/AppShell';
import { RiskBadge, ShelfBadge } from '@/components/ui/Badges';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { Segmented } from '@/components/ui/Segmented';
import { StockBar } from '@/components/ui/StockBar';
import { useToast } from '@/components/ui/Toast';
import type { Product } from '@/domain/types';
import type { ProductInsight } from '@/engine/inventory';
import { RISK_LABEL, SHELF_SHORT } from '@/lib/colors';
import { downloadCsv } from '@/lib/csv';
import { toDateKey } from '@/lib/dates';
import { money, number, qty } from '@/lib/format';
import { useFilteredProducts } from '@/store/hooks';
import { useStore } from '@/store/StoreProvider';

type SortKey = 'riesgo' | 'gondola' | 'agotamiento' | 'nombre' | 'valor';
const RISK_RANK = { critico: 0, alto: 1, medio: 2, bajo: 3 } as const;

export default function ProductsPage() {
  const { state, insights, categoryById, dispatch } = useStore();
  const { openMovement } = useActions();
  const toast = useToast();
  const filtered = useFilteredProducts();
  const [sort, setSort] = useState<SortKey>('riesgo');
  const today = toDateKey(new Date(state.now));

  const rows = useMemo(() => {
    const list = [...filtered];
    const by: Record<SortKey, (a: Product, b: Product) => number> = {
      riesgo: (a, b) => RISK_RANK[insights[a.id].risk] - RISK_RANK[insights[b.id].risk] || insights[b.id].stockoutProbability - insights[a.id].stockoutProbability,
      gondola: (a, b) => insights[a.id].gondolaPct - insights[b.id].gondolaPct,
      agotamiento: (a, b) => insights[a.id].daysToStockout - insights[b.id].daysToStockout,
      nombre: (a, b) => a.name.localeCompare(b.name, 'es'),
      valor: (a, b) => insights[b.id].inventoryValue - insights[a.id].inventoryValue,
    };
    return list.sort(by[sort]);
  }, [filtered, insights, sort]);

  const quickSell = (p: Product) => {
    dispatch({ type: 'SELL', productId: p.id, qty: 1 });
    if (p.stockGondola < 1) toast(`${p.name}: góndola sin stock suficiente, se registró una venta perdida.`, 'warning');
    else toast(`Venta de 1 ${p.unit === 'kg' ? 'kg' : 'un.'} de ${p.name}.`);
  };
  const quickRefill = (p: Product, i: ProductInsight) => {
    const amount = i.shelfRefill > 0 ? i.shelfRefill : Math.min(p.stockAlmacen, Math.max(0, p.gondolaCapacity - p.stockGondola));
    if (amount <= 0) {
      toast(p.stockAlmacen <= 0 ? 'No hay stock en almacén para reponer.' : 'La góndola ya está llena.', 'info');
      return;
    }
    dispatch({ type: 'REFILL', productId: p.id, qty: amount });
    toast(`Se bajaron ${number(amount)} ${p.unit === 'kg' ? 'kg' : 'un.'} de ${p.name} a ${p.location}.`);
  };

  const exportCsv = () =>
    downloadCsv(
      `catalogo-3a-${today}.csv`,
      rows.map((p) => {
        const i = insights[p.id];
        return {
          SKU: p.sku,
          Producto: p.name,
          Categoría: categoryById[p.categoryId]?.name ?? '',
          Unidad: p.unit,
          'Stock góndola': p.stockGondola,
          'Capacidad góndola': p.gondolaCapacity,
          'Stock almacén': p.stockAlmacen,
          'Estado góndola': SHELF_SHORT[i.shelfStatus],
          'Consumo diario (7d)': number(i.avgDaily7),
          'Días para agotarse': Number.isFinite(i.daysToStockout) ? number(i.daysToStockout) : '>60',
          Riesgo: RISK_LABEL[i.risk],
          'Precio (S/)': p.price,
          'Valor inventario (S/)': number(i.inventoryValue),
          Ubicación: p.location,
        };
      }),
    );

  return (
    <>
      <PageHeader
        title="Catálogo y stock"
        description="Gestión interactiva del inventario: góndola y almacén por separado, reposición en un toque y registro de movimientos en el kardex."
        actions={
          <>
            <button className="btn-outline" onClick={exportCsv}>
              <Download size={16} aria-hidden /> CSV
            </button>
            <button className="btn-primary" onClick={() => openMovement()}>
              <Plus size={16} aria-hidden /> Registrar movimiento
            </button>
          </>
        }
      />
      <FilterBar count={filtered.length} total={state.products.length} />

      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">Ordenar por</span>
        <div className="no-scrollbar overflow-x-auto">
          <Segmented<SortKey>
            value={sort}
            onChange={setSort}
            ariaLabel="Ordenar"
            options={[
              { value: 'riesgo', label: 'Riesgo' },
              { value: 'gondola', label: '% góndola' },
              { value: 'agotamiento', label: 'Agotamiento' },
              { value: 'valor', label: 'Valor' },
              { value: 'nombre', label: 'Nombre' },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel">
          <EmptyState icon={PackageSearch} title="Ningún producto coincide">
            Ajusta la búsqueda o los filtros de categoría y riesgo.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="panel hidden overflow-hidden lg:block">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[1040px]">
                <thead className="border-b border-line bg-page/60">
                  <tr>
                    <th className="th pl-5">Producto</th>
                    <th className="th w-[220px]">Góndola</th>
                    <th className="th text-right">Almacén</th>
                    <th className="th text-right">Consumo/día</th>
                    <th className="th">Se agota</th>
                    <th className="th">Riesgo</th>
                    <th className="th pr-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((p) => {
                    const i = insights[p.id];
                    const c = categoryById[p.categoryId];
                    return (
                      <tr key={p.id} className="hover:bg-page/50">
                        <td className="td pl-5">
                          <div className="flex items-center gap-3">
                            <ProductAvatar product={p} category={c} />
                            <div className="min-w-0">
                              <Link to={`/analisis?p=${p.id}`} className="block truncate font-semibold hover:underline">
                                {p.name}
                              </Link>
                              <div className="truncate text-xs text-muted">
                                {c?.name} · {p.sku} · {p.location}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="td">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="num font-semibold text-ink">
                              {qty(p.stockGondola, p.unit)} <span className="font-normal text-faint">/ {number(p.gondolaCapacity)}</span>
                            </span>
                            <ShelfBadge status={i.shelfStatus} size="xs" />
                          </div>
                          <StockBar pct={i.gondolaPct} status={i.shelfStatus} className="mt-1.5" />
                          <div className="mt-1 text-[11px] text-muted">Se vacía: {gondolaWhen(i, today, p)}</div>
                        </td>
                        <td className="td num text-right font-semibold">{qty(p.stockAlmacen, p.unit)}</td>
                        <td className="td num text-right">
                          {number(i.avgDaily7)}
                          <div className="text-[11px] text-muted">{money(i.avgDaily7 * p.price)}</div>
                        </td>
                        <td className="td num whitespace-nowrap text-sm">{stockoutWhen(i, today)}</td>
                        <td className="td">
                          <RiskBadge risk={i.risk} />
                        </td>
                        <td className="td pr-5">
                          <RowActions p={p} onSell={() => quickSell(p)} onRefill={() => quickRefill(p, i)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Móvil y tablet: tarjetas */}
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map((p) => {
              const i = insights[p.id];
              const c = categoryById[p.categoryId];
              return (
                <article key={p.id} className="panel min-w-0 p-4">
                  <div className="flex items-start gap-3">
                    <ProductAvatar product={p} category={c} size={40} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/analisis?p=${p.id}`} className="block truncate font-semibold">
                        {p.name}
                      </Link>
                      <div className="truncate text-xs text-muted">{p.location}</div>
                    </div>
                    <RiskBadge risk={i.risk} size="xs" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-page px-3 py-2">
                      <div className="text-[11px] font-semibold text-muted">Góndola</div>
                      <div className="num text-lg font-bold">{qty(p.stockGondola, p.unit)}</div>
                    </div>
                    <div className="rounded-lg bg-page px-3 py-2">
                      <div className="text-[11px] font-semibold text-muted">Almacén</div>
                      <div className="num text-lg font-bold">{qty(p.stockAlmacen, p.unit)}</div>
                    </div>
                  </div>
                  <StockBar pct={i.gondolaPct} status={i.shelfStatus} className="mt-3" />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                    <span>Góndola se vacía: {gondolaWhen(i, today, p)}</span>
                    <span>Agota: {stockoutWhen(i, today)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button className="btn-outline min-w-0 px-1.5 text-xs" onClick={() => quickSell(p)}>
                      <ShoppingCart size={14} aria-hidden /> Vender
                    </button>
                    <button className="btn-outline min-w-0 px-1.5 text-xs" onClick={() => quickRefill(p, i)} disabled={p.stockAlmacen <= 0}>
                      <ArrowRightLeft size={14} aria-hidden /> Reponer
                    </button>
                    <button className="btn-primary min-w-0 px-1.5 text-xs" onClick={() => openMovement({ productId: p.id, kind: 'entrada' })}>
                      <ClipboardList size={14} aria-hidden /> Más
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function RowActions({ p, onSell, onRefill }: { p: Product; onSell: () => void; onRefill: () => void }) {
  const { openMovement } = useActions();
  const btn = 'grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-page hover:text-ink disabled:opacity-40';
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button className={btn} onClick={onSell} title="Vender 1 (simulación de caja)" aria-label={`Vender 1 ${p.name}`}>
        <ShoppingCart size={16} />
      </button>
      <button className={btn} onClick={onRefill} disabled={p.stockAlmacen <= 0} title="Reponer góndola desde almacén" aria-label={`Reponer ${p.name}`}>
        <ArrowRightLeft size={16} />
      </button>
      <button className={btn} onClick={() => openMovement({ productId: p.id, kind: 'entrada' })} title="Entrada al almacén" aria-label={`Entrada ${p.name}`}>
        <PackagePlus size={16} />
      </button>
      <button className={btn} onClick={() => openMovement({ productId: p.id, kind: 'merma' })} title="Registrar merma" aria-label={`Merma ${p.name}`}>
        <PackageMinus size={16} />
      </button>
      <button className={btn} onClick={() => openMovement({ productId: p.id, kind: 'ajuste' })} title="Ajuste por conteo físico" aria-label={`Ajuste ${p.name}`}>
        <ClipboardList size={16} />
      </button>
      <Link to={`/analisis?p=${p.id}`} className={btn} title="Ver análisis" aria-label={`Análisis de ${p.name}`}>
        <ChartLine size={16} />
      </Link>
    </div>
  );
}
