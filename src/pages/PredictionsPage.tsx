import { BrainCircuit, CalendarClock, ChevronDown, Download, Hourglass, PackageCheck, PackageSearch, Truck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActions } from '@/components/inventory/ActionsProvider';
import { FilterBar } from '@/components/inventory/FilterBar';
import { dayWord, orderWhen, packText, stockoutSpan, stockoutWhen } from '@/components/inventory/labels';
import { PageHeader } from '@/components/layout/AppShell';
import { AiTag, RiskBadge } from '@/components/ui/Badges';
import { EmptyState } from '@/components/ui/EmptyState';
import { Kpi } from '@/components/ui/Kpi';
import { Panel } from '@/components/ui/Panel';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import type { EngineSettings, Product } from '@/domain/types';
import type { ProductInsight } from '@/engine/inventory';
import { RISK_COLOR, RISK_LABEL } from '@/lib/colors';
import { downloadCsv } from '@/lib/csv';
import { formatDayShort, toDateKey } from '@/lib/dates';
import { money, number, probability, qty, signedPercent } from '@/lib/format';
import { useFilteredProducts } from '@/store/hooks';
import { useStore } from '@/store/StoreProvider';

const RISK_RANK = { critico: 0, alto: 1, medio: 2, bajo: 3 } as const;

export default function PredictionsPage() {
  const { state, insights, dispatch, categoryById, productById } = useStore();
  const { openOrder } = useActions();
  const toast = useToast();
  const filtered = useFilteredProducts();
  const today = toDateKey(new Date(state.now));
  const [showMethod, setShowMethod] = useState(false);

  const rows = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          RISK_RANK[insights[a.id].risk] - RISK_RANK[insights[b.id].risk] || insights[a.id].daysToStockout - insights[b.id].daysToStockout,
      ),
    [filtered, insights],
  );
  const toOrder = state.products.filter((p) => insights[p.id].orderInDays === 0 && insights[p.id].suggestedOrderQty > 0);
  const soon = state.products.filter((p) => insights[p.id].daysToStockout <= 3).length;
  const avgProb = state.products.reduce((s, p) => s + insights[p.id].stockoutProbability, 0) / state.products.length;
  const orderCost = toOrder.reduce((s, p) => s + insights[p.id].suggestedOrderQty * p.cost, 0);
  const pending = state.orders.filter((o) => o.status === 'pendiente');

  const setSettings = (patch: Partial<EngineSettings>) => dispatch({ type: 'SET_SETTINGS', patch });

  const exportCsv = () =>
    downloadCsv(
      `predicciones-3a-${today}.csv`,
      rows.map((p) => {
        const i = insights[p.id];
        return {
          SKU: p.sku,
          Producto: p.name,
          'Consumo promedio 7d': number(i.avgDaily7),
          'Pronóstico diario': number(i.forecastDaily),
          'Tendencia semanal': signedPercent(i.trendWeekly),
          'Stock total': i.onHand,
          'En camino': i.onOrder,
          'Días para agotarse': Number.isFinite(i.daysToStockout) ? number(i.daysToStockout) : '>60',
          'Fecha de agotamiento': i.stockoutDate ?? '',
          'Fecha sugerida de pedido': i.orderDate ?? '',
          'Reabastecimiento estimado': i.restockDate ?? '',
          'Stock de seguridad': number(i.safetyStock),
          'Punto de reorden': number(i.reorderPoint),
          'Pedido sugerido': i.suggestedOrderQty,
          'Prob. de quiebre': probability(i.stockoutProbability),
          Riesgo: RISK_LABEL[i.risk],
          'MAPE backtest (%)': number(i.quality.mape),
        };
      }),
    );

  return (
    <>
      <PageHeader
        title="Módulo predictivo"
        description="Para cada producto: tiempo promedio hasta el agotamiento, fecha estimada de reabastecimiento, pedido sugerido y nivel de riesgo de desabastecimiento. Se recalcula con cada venta o cambio de stock."
        actions={
          <>
            <button className="btn-outline" onClick={exportCsv}>
              <Download size={16} aria-hidden /> CSV
            </button>
            <button className="btn-primary" disabled={toOrder.length === 0} onClick={() => openOrder(toOrder.map((p) => ({ productId: p.id, qty: insights[p.id].suggestedOrderQty })))}>
              <Truck size={16} aria-hidden /> Generar {toOrder.length} pedidos sugeridos
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pedidos sugeridos para hoy" value={toOrder.length} sub={`Costo estimado ${money(orderCost)}`} icon={Truck} tone={toOrder.length ? 'medio' : 'default'} />
        <Kpi label="Se agotan en ≤ 3 días" value={soon} sub="Considera pedidos en camino" icon={Hourglass} tone={soon ? 'critico' : 'bajo'} />
        <Kpi label="Prob. media de quiebre" value={probability(avgProb)} sub="Antes de la próxima reposición" icon={BrainCircuit} tone={avgProb > 0.2 ? 'alto' : 'bajo'} />
        <Kpi label="Pedidos en camino" value={pending.length} sub="Desde el centro de distribución" icon={CalendarClock} />
      </div>

      <Panel
        className="mt-4"
        title="Parámetros del motor"
        subtitle="Cambia un parámetro y todas las predicciones se recalculan al instante"
        actions={
          <button className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline" onClick={() => setShowMethod((v) => !v)} aria-expanded={showMethod}>
            ¿Cómo se calcula? <ChevronDown size={14} className={`transition-transform ${showMethod ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Nivel de servicio" hint="Define el stock de seguridad (z)">
            <Segmented<number>
              value={state.settings.serviceLevel}
              onChange={(v) => setSettings({ serviceLevel: v as EngineSettings['serviceLevel'] })}
              options={[
                { value: 0.9, label: '90 %' },
                { value: 0.95, label: '95 %' },
                { value: 0.99, label: '99 %' },
              ]}
            />
          </Field>
          <Field label={`Cobertura del pedido: ${state.settings.coverageDays} días`} hint="Días que debe durar el pedido tras llegar">
            <input type="range" min={3} max={21} value={state.settings.coverageDays} onChange={(e) => setSettings({ coverageDays: Number(e.target.value) })} className="w-full accent-ink" aria-label="Días de cobertura" />
          </Field>
          <Field label="Historia para entrenar" hint="Días de ventas usados por el modelo">
            <Segmented<number>
              value={state.settings.lookbackDays}
              onChange={(v) => setSettings({ lookbackDays: v })}
              options={[
                { value: 28, label: '28 d' },
                { value: 42, label: '42 d' },
                { value: 56, label: '56 d' },
              ]}
            />
          </Field>
          <Field label="Horizonte de los gráficos" hint="Días de pronóstico mostrados">
            <Segmented<number>
              value={state.settings.horizonDays}
              onChange={(v) => setSettings({ horizonDays: v })}
              options={[
                { value: 7, label: '7 d' },
                { value: 14, label: '14 d' },
                { value: 28, label: '28 d' },
              ]}
            />
          </Field>
        </div>
        {showMethod && <Methodology />}
      </Panel>

      <div className="mt-6">
        <FilterBar count={filtered.length} total={state.products.length} />
      </div>

      {rows.length === 0 ? (
        <div className="panel">
          <EmptyState icon={PackageSearch} title="Ningún producto coincide con los filtros" />
        </div>
      ) : (
        <>
          <div className="panel hidden overflow-hidden lg:block">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[1240px]">
                <thead className="border-b border-line bg-page/60">
                  <tr>
                    <th className="th pl-5">Producto</th>
                    <th className="th text-right">Consumo prom./día</th>
                    <th className="th text-right">Stock total</th>
                    <th className="th">Tiempo para agotarse</th>
                    <th className="th">Pedir</th>
                    <th className="th">Reabastecimiento</th>
                    <th className="th">Pedido sugerido</th>
                    <th className="th w-[150px]">Prob. de quiebre</th>
                    <th className="th pr-5">Riesgo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((p) => (
                    <PredictionRow key={p.id} p={p} i={insights[p.id]} today={today} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map((p) => (
              <PredictionCard key={p.id} p={p} i={insights[p.id]} today={today} />
            ))}
          </div>
        </>
      )}

      <Panel className="mt-4" title="Pedidos en camino" subtitle="Llegan al almacén al abrir la tienda en la fecha estimada (o confírmalos manualmente)" bodyClassName="p-0">
        {pending.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No hay pedidos pendientes.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((o) => {
              const p = productById[o.productId];
              if (!p) return null;
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <ProductAvatar product={p} category={categoryById[p.categoryId]} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted">
                      {o.id} · {qty(o.qty, p.unit)} · llega <strong className="text-ink">{dayWord(o.etaDate, today)}</strong> ({formatDayShort(o.etaDate)})
                    </div>
                  </div>
                  <button
                    className="btn-outline h-8 text-xs"
                    onClick={() => {
                      dispatch({ type: 'RECEIVE_ORDER', orderId: o.id });
                      toast(`Pedido de ${p.name} recibido en almacén.`);
                    }}
                  >
                    <PackageCheck size={14} aria-hidden /> Recibir
                  </button>
                  <button
                    className="btn-ghost h-8 text-xs text-muted"
                    onClick={() => {
                      dispatch({ type: 'CANCEL_ORDER', orderId: o.id });
                      toast(`Pedido ${o.id} cancelado.`, 'info');
                    }}
                  >
                    <X size={14} aria-hidden /> Cancelar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink">{label}</div>
      <div className="mb-2 text-[11px] text-muted">{hint}</div>
      {children}
    </div>
  );
}

function ProbBar({ p, risk }: { p: number; risk: ProductInsight['risk'] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, p * 100)}%`, background: RISK_COLOR[risk] }} />
      </div>
      <span className="num w-10 text-right text-xs font-semibold">{probability(p)}</span>
    </div>
  );
}

function OrderButton({ p, i }: { p: Product; i: ProductInsight }) {
  const { openOrder } = useActions();
  if (i.suggestedOrderQty <= 0) return <span className="text-xs text-muted">—</span>;
  const now = i.orderInDays === 0;
  return (
    <button
      onClick={() => openOrder([{ productId: p.id, qty: i.suggestedOrderQty }])}
      className={`group text-left ${now ? '' : 'opacity-80'}`}
      title="Generar pedido"
    >
      <div className={`num text-sm font-bold ${now ? 'text-ink group-hover:underline' : 'text-muted'}`}>{packText(p, i.suggestedPacks)}</div>
      <div className="num text-[11px] text-muted">
        {qty(i.suggestedOrderQty, p.unit)} · {money(i.suggestedOrderQty * p.cost)}
      </div>
    </button>
  );
}

function PredictionRow({ p, i, today }: { p: Product; i: ProductInsight; today: string }) {
  const { categoryById } = useStore();
  return (
    <tr className="hover:bg-page/50">
      <td className="td pl-5">
        <div className="flex items-center gap-3">
          <ProductAvatar product={p} category={categoryById[p.categoryId]} />
          <div className="min-w-0">
            <Link to={`/analisis?p=${p.id}`} className="block truncate font-semibold hover:underline">
              {p.name}
            </Link>
            <div className="text-xs text-muted">
              Entrega {p.leadTimeDays} d · {p.packLabel}
            </div>
          </div>
        </div>
      </td>
      <td className="td num text-right">
        <div className="font-semibold">{qty(i.avgDaily7, p.unit)}</div>
        <div className={`whitespace-nowrap text-[11px] ${i.trendWeekly > 0.02 ? 'text-riskText-alto' : i.trendWeekly < -0.02 ? 'text-riskText-bajo' : 'text-muted'}`}>
          {signedPercent(i.trendWeekly)}/sem · pron. {number(i.forecastDaily)}
        </div>
      </td>
      <td className="td num text-right">
        <div className="font-semibold">{qty(i.onHand, p.unit)}</div>
        {i.onOrder > 0 && <div className="text-[11px] text-riskText-bajo">+{number(i.onOrder)} en camino</div>}
      </td>
      <td className="td">
        <div className="num font-semibold">{stockoutSpan(i)}</div>
        <div className="num text-[11px] text-muted">{stockoutWhen(i, today)}</div>
      </td>
      <td className="td">
        <span className={`num whitespace-nowrap text-sm font-semibold ${i.orderInDays === 0 ? 'text-brand' : ''}`}>{orderWhen(i, today)}</span>
      </td>
      <td className="td">
        {i.restockDate ? (
          <>
            <div className="num text-sm font-semibold">{dayWord(i.restockDate, today)}</div>
            <div className="text-[11px] text-muted">{i.restockSource === 'pedido' ? 'Pedido en camino' : 'Si se pide a tiempo'}</div>
          </>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
        {i.gapBeforeRestock && i.onHand > 0 && <div className="text-[11px] font-semibold text-riskText-critico">Quiebre antes de llegar</div>}
      </td>
      <td className="td">
        <OrderButton p={p} i={i} />
      </td>
      <td className="td">
        <ProbBar p={i.stockoutProbability} risk={i.risk} />
      </td>
      <td className="td pr-5">
        <RiskBadge risk={i.risk} />
      </td>
    </tr>
  );
}

function PredictionCard({ p, i, today }: { p: Product; i: ProductInsight; today: string }) {
  const { categoryById } = useStore();
  const { openOrder } = useActions();
  return (
    <article className="panel min-w-0 p-4">
      <div className="flex items-start gap-3">
        <ProductAvatar product={p} category={categoryById[p.categoryId]} size={40} />
        <div className="min-w-0 flex-1">
          <Link to={`/analisis?p=${p.id}`} className="block truncate font-semibold">
            {p.name}
          </Link>
          <div className="text-xs text-muted">
            {qty(i.avgDaily7, p.unit)}/día · {signedPercent(i.trendWeekly)}/sem
          </div>
        </div>
        <RiskBadge risk={i.risk} size="xs" />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Stat label="Se agota en" value={stockoutSpan(i)} sub={stockoutWhen(i, today)} />
        <Stat label="Reabastecimiento" value={i.restockDate ? dayWord(i.restockDate, today) : '—'} sub={i.restockSource === 'pedido' ? 'Pedido en camino' : orderWhen(i, today)} />
        <Stat label="Stock total" value={qty(i.onHand, p.unit)} sub={i.onOrder ? `+${number(i.onOrder)} en camino` : undefined} />
        <Stat label="Prob. de quiebre" value={probability(i.stockoutProbability)} />
      </dl>
      {i.suggestedOrderQty > 0 && (
        <button className={`mt-3 w-full ${i.orderInDays === 0 ? 'btn-primary' : 'btn-outline'}`} onClick={() => openOrder([{ productId: p.id, qty: i.suggestedOrderQty }])}>
          <Truck size={15} aria-hidden /> {i.orderInDays === 0 ? 'Pedir' : 'Próximo pedido:'} {packText(p, i.suggestedPacks)} ({qty(i.suggestedOrderQty, p.unit)})
        </button>
      )}
    </article>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-page px-2.5 py-2">
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className="num text-sm font-bold text-ink">{value}</dd>
      {sub && <dd className="num text-[11px] text-muted">{sub}</dd>}
    </div>
  );
}

function Methodology() {
  const items = [
    ['Consumo y tendencia', 'Regresión lineal por mínimos cuadrados sobre las ventas diarias desestacionalizadas, multiplicada por un índice por día de la semana. Se mezcla con un promedio móvil exponencial para estabilizar el nivel reciente.'],
    ['Corrección intradía', 'Compara lo vendido hoy con lo esperado a esta hora (perfil por franja horaria) y ajusta el pronóstico. Si la góndola está vacía no se corrige a la baja (demanda censurada).'],
    ['Tiempo para agotarse', 'Proyecta el stock (góndola + almacén) día a día restando la demanda pronosticada y sumando los pedidos en camino en su fecha de llegada.'],
    ['Stock de seguridad', 'SS = z × σ × √(tiempo de entrega), donde σ es el error típico del modelo y z depende del nivel de servicio.'],
    ['Punto de reorden y fecha de pedido', 'ROP = demanda durante el tiempo de entrega + 1 día de revisión + SS. La fecha de pedido es el primer día en que el stock disponible (incluye lo pedido) cae por debajo del ROP.'],
    ['Pedido sugerido', 'Cantidad para cubrir el tiempo de entrega + los días de cobertura + SS, menos el stock disponible, redondeada a bultos completos.'],
    ['Riesgo de desabastecimiento', 'Probabilidad (aprox. normal) de que la demanda supere el stock antes de la próxima reposición posible. Crítico ≥ 50 %, alto ≥ 20 % o pedido requerido hoy, medio ≥ 5 % o pedido en ≤ 2 días.'],
    ['Validación', 'Backtest con los últimos 7 días fuera de muestra: MAPE, MAE y RMSE por producto (meta del informe: MAPE ≤ 20 %).'],
  ];
  return (
    <div className="mt-5 grid gap-3 border-t border-line pt-4 md:grid-cols-2">
      {items.map(([t, d]) => (
        <div key={t} className="rounded-lg bg-page p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
            <AiTag /> {t}
          </div>
          <p className="text-xs leading-relaxed text-muted">{d}</p>
        </div>
      ))}
    </div>
  );
}
