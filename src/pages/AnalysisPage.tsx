import { ArrowLeft, ArrowRightLeft, ShoppingCart, Truck } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { DonutChart, HBarChart, HourlyChart, PieLegend, WeekdayChart } from '@/components/charts/SimpleCharts';
import { StockProjectionChart } from '@/components/charts/StockProjectionChart';
import { useActions } from '@/components/inventory/ActionsProvider';
import { dayWord, gondolaWhen, orderWhen, packText, stockoutSpan, stockoutWhen } from '@/components/inventory/labels';
import { PageHeader } from '@/components/layout/AppShell';
import { FilterChip } from '@/components/layout/GlobalSearch';
import { AiTag, RiskBadge, ShelfBadge } from '@/components/ui/Badges';
import { Kpi } from '@/components/ui/Kpi';
import { Panel } from '@/components/ui/Panel';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { Segmented } from '@/components/ui/Segmented';
import { StockBar } from '@/components/ui/StockBar';
import type { Product } from '@/domain/types';
import { buildSeries, hourlyToday, type Metric, summarize, weekdayProfile } from '@/engine/aggregate';
import type { ProductInsight } from '@/engine/inventory';
import { hourSlot } from '@/engine/intraday';
import { categoryColor, RISK_COLOR, RISK_LABEL, RISK_ORDER } from '@/lib/colors';
import { formatDateTime, toDateKey, weekdayIndex } from '@/lib/dates';
import { axisMoney, axisNumber, money, moneyCompact, number, probability, qty, signedPercent } from '@/lib/format';
import { useStore } from '@/store/StoreProvider';

type Range = 14 | 28 | 56;

export default function AnalysisPage() {
  const { state, insights, categories, categoryById, productById } = useStore();
  const [params, setParams] = useSearchParams();
  const productId = params.get('p');
  const product = productId ? productById[productId] : undefined;
  const catId = product?.categoryId ?? params.get('cat') ?? 'all';
  const category = catId !== 'all' ? categoryById[catId] : undefined;
  const range = (Number(params.get('r')) || 28) as Range;
  // Al mezclar categorías (kg y unidades) solo tiene sentido sumar en soles.
  const metric: Metric = !category && !product ? 'revenue' : ((params.get('m') as Metric) ?? 'units');

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
    setParams(next, { replace: true });
  };

  const group = useMemo(() => state.products.filter((p) => catId === 'all' || p.categoryId === catId), [state.products, catId]);
  const scope = product ? [product] : group;

  return (
    <>
      <PageHeader
        title="Análisis"
        description="Explora el comportamiento global de la tienda, de una categoría o de un producto específico. Todos los gráficos reaccionan en vivo a las ventas y a los cambios de stock."
      />

      <div className="panel mb-4 space-y-3 p-4">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          <FilterChip active={catId === 'all' && !product} onClick={() => set({ cat: null, p: null, m: null })}>
            🏪 Toda la tienda
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.id} active={catId === c.id} color={categoryColor(c.colorSlot)} onClick={() => set({ cat: c.id, p: null })}>
              {c.emoji} {c.name}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm">
            <span className="shrink-0 text-xs font-semibold text-muted">Producto</span>
            <select className="input h-9 py-1" value={product?.id ?? ''} onChange={(e) => set({ p: e.target.value || null, cat: e.target.value ? productById[e.target.value].categoryId : catId === 'all' ? null : catId })}>
              <option value="">{category ? `Toda la categoría ${category.name}` : 'Todos los productos'}</option>
              {(category ? group : state.products).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Range>
              value={range}
              onChange={(v) => set({ r: String(v) })}
              ariaLabel="Rango histórico"
              options={[
                { value: 14, label: '14 días' },
                { value: 28, label: '28 días' },
                { value: 56, label: '56 días' },
              ]}
            />
            {(category || product) && (
              <Segmented<Metric>
                value={metric}
                onChange={(v) => set({ m: v })}
                ariaLabel="Métrica"
                options={[
                  { value: 'units', label: product?.unit === 'kg' || category?.id === 'fv' ? 'Kilos' : 'Unidades' },
                  { value: 'revenue', label: 'Soles' },
                ]}
              />
            )}
          </div>
        </div>
      </div>

      {product ? (
        <ProductView product={product} insight={insights[product.id]} metric={metric} range={range} onBack={() => set({ p: null })} />
      ) : (
        <GroupView products={scope} metric={metric} range={range} isStore={!category} onSelectProduct={(id) => set({ p: id, cat: productById[id].categoryId })} onSelectCategory={(id) => set({ cat: id, p: null })} />
      )}
    </>
  );
}

/* ---------------------------- Vista de conjunto ---------------------------- */

function GroupView({
  products,
  metric,
  range,
  isStore,
  onSelectProduct,
  onSelectCategory,
}: {
  products: Product[];
  metric: Metric;
  range: Range;
  isStore: boolean;
  onSelectProduct: (id: string) => void;
  onSelectCategory: (id: string) => void;
}) {
  const { state, insights, categories, categoryById } = useStore();
  const today = toDateKey(new Date(state.now));
  const fmt = metric === 'revenue' ? axisMoney : axisNumber;
  const unitWord = metric === 'revenue' ? 'S/' : products[0]?.unit === 'kg' ? 'kg' : 'unidades';

  const series = useMemo(
    () => buildSeries(products, state.history, state.todaySales, insights, metric, range, state.settings.horizonDays),
    [products, state.history, state.todaySales, insights, metric, range, state.settings.horizonDays],
  );
  const weekday = useMemo(() => weekdayProfile(products, state.history, metric), [products, state.history, metric]);
  const hourly = useMemo(() => hourlyToday(products, state.todayHourly, insights, metric), [products, state.todayHourly, insights, metric]);
  const s = summarize(products, insights);

  const factor = (p: Product) => (metric === 'revenue' ? p.price : 1);
  const next7 = products.reduce((acc, p) => acc + insights[p.id].forecast.slice(1, 8).reduce((x, f) => x + f.expected, 0) * factor(p), 0);
  const last7 = products.reduce((acc, p) => acc + (state.history[p.id] ?? []).slice(-7).reduce((x, d) => x + d.units, 0) * factor(p), 0);
  const growth = last7 > 0 ? next7 / last7 - 1 : 0;

  // Participación en ventas de los últimos 7 días (por categoría o por producto).
  const share = isStore
    ? categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: categoryColor(c.colorSlot),
        value: products.filter((p) => p.categoryId === c.id).reduce((acc, p) => acc + (state.history[p.id] ?? []).slice(-7).reduce((x, d) => x + d.units, 0) * p.price, 0),
      }))
    : products.map((p, idx) => ({
        id: p.id,
        name: p.name,
        color: shade(categoryColor(categoryById[p.categoryId]?.colorSlot ?? 0), idx, products.length),
        value: (state.history[p.id] ?? []).slice(-7).reduce((x, d) => x + d.units, 0) * factor(p),
      }));
  const shareSorted = [...share].sort((a, b) => b.value - a.value);

  const consumption = products
    .map((p, idx) => ({
      id: p.id,
      name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name,
      value: insights[p.id].forecastDaily * factor(p),
      color: isStore ? categoryColor(categoryById[p.categoryId]?.colorSlot ?? 0) : shade(categoryColor(categoryById[p.categoryId]?.colorSlot ?? 0), idx, products.length),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, isStore ? 12 : 20);

  const coverage = products
    .map((p) => ({
      id: p.id,
      name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name,
      value: Math.min(Number.isFinite(insights[p.id].daysToStockout) ? insights[p.id].daysToStockout : 30, 30),
      color: RISK_COLOR[insights[p.id].risk],
    }))
    .sort((a, b) => a.value - b.value)
    .slice(0, isStore ? 12 : 20);

  const riskData = RISK_ORDER.map((r) => ({ name: RISK_LABEL[r], value: s.riskCounts[r], color: RISK_COLOR[r] }));
  const avgLead = products.reduce((a, p) => a + p.leadTimeDays, 0) / Math.max(1, products.length);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Ventas de hoy" value={moneyCompact(s.revenueToday)} sub={`Esperado: ${moneyCompact(s.expectedRevenueToday)}`} />
        <Kpi label={`Pronóstico 7 días (${unitWord})`} value={metric === 'revenue' ? moneyCompact(next7) : number(next7)} sub={`${signedPercent(growth)} vs. últimos 7 días`} tone={growth > 0.03 ? 'bajo' : growth < -0.03 ? 'alto' : 'default'} />
        <Kpi label="Productos en riesgo" value={`${s.riskCounts.critico + s.riskCounts.alto}/${s.count}`} tone={s.riskCounts.critico ? 'critico' : 'default'} sub={`${s.outOfShelf} góndolas vacías`} />
        <Kpi label="Valor del inventario" value={moneyCompact(s.stockValue)} sub={`A precio de venta: ${moneyCompact(s.retailValue)}`} />
        <Kpi label="Error del pronóstico" value={`${number(s.avgMape)} %`} sub="MAPE promedio (backtest 7 días)" tone={s.avgMape <= 20 ? 'bajo' : 'medio'} />
      </div>

      <Panel title={isStore ? 'Ventas de toda la tienda' : `Ventas de la categoría`} subtitle={`Histórico de ${range} días, ajuste del modelo y pronóstico a ${state.settings.horizonDays} días · ${unitWord}`} actions={<AiTag />}>
        <ForecastChart data={series} format={fmt} height={300} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={isStore ? 'Participación por categoría' : 'Participación por producto'} subtitle={`Ventas de los últimos 7 días · ${isStore ? 'S/' : unitWord}`}>
          <DonutChart data={shareSorted} centerValue={metric === 'revenue' || isStore ? moneyCompact(shareSorted.reduce((a, d) => a + d.value, 0)) : number(shareSorted.reduce((a, d) => a + d.value, 0))} centerLabel="últimos 7 días" format={isStore || metric === 'revenue' ? money : (v) => number(v)} />
          <div className="mt-3 max-h-48 overflow-y-auto pr-1 scroll-thin">
            <PieLegend data={shareSorted} format={isStore || metric === 'revenue' ? moneyCompact : (v) => number(v)} />
          </div>
        </Panel>
        <Panel title="Consumo diario pronosticado" subtitle={`Promedio próximos 7 días · ${unitWord}/día · toca una barra para ver el producto`}>
          <HBarChart data={consumption} format={fmt} onSelect={onSelectProduct} />
        </Panel>
        <Panel title="Días hasta el agotamiento" subtitle={`Color = nivel de riesgo · línea = tiempo de entrega medio (${number(avgLead)} d)`}>
          <HBarChart data={coverage} format={(v) => `${number(v)} d`} onSelect={onSelectProduct} reference={{ value: avgLead, label: 'Entrega' }} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Ventas por franja horaria (hoy)" subtitle={unitWord} className="lg:col-span-2">
          <HourlyChart data={hourly} currentSlot={hourSlot(new Date(state.now))} format={fmt} />
        </Panel>
        <Panel title="Riesgo de desabastecimiento" subtitle="Distribución de productos" actions={<AiTag />}>
          <DonutChart data={riskData} centerValue={String(s.count)} centerLabel="productos" format={(v) => `${v} productos`} height={170} />
          <div className="mt-3">
            <PieLegend data={riskData} format={(v) => String(v)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Estacionalidad semanal" subtitle={`Promedio por día de semana (4 semanas) · ${unitWord}`}>
          <WeekdayChart values={weekday} highlight={weekdayIndex(today)} format={fmt} />
        </Panel>
        <Panel title={isStore ? 'Categorías' : 'Productos de la categoría'} subtitle="Toca para profundizar" className="lg:col-span-2" bodyClassName="p-0">
          {isStore ? (
            <CategoryTable onSelect={onSelectCategory} />
          ) : (
            <ul className="divide-y divide-line">
              {[...products]
                .sort((a, b) => insights[b.id].stockoutProbability - insights[a.id].stockoutProbability)
                .map((p) => {
                  const i = insights[p.id];
                  return (
                    <li key={p.id}>
                      <button onClick={() => onSelectProduct(p.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-page sm:px-5">
                        <ProductAvatar product={p} category={categoryById[p.categoryId]} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.name}</span>
                          <span className="block text-xs text-muted">
                            {qty(i.forecastDaily, p.unit)}/día · agota {stockoutWhen(i, today)}
                          </span>
                        </span>
                        <span className="hidden w-28 sm:block">
                          <StockBar pct={i.gondolaPct} status={i.shelfStatus} />
                        </span>
                        <RiskBadge risk={i.risk} size="xs" />
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CategoryTable({ onSelect }: { onSelect: (id: string) => void }) {
  const { state, insights, categories } = useStore();
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[520px]">
        <thead className="border-b border-line bg-page/60">
          <tr>
            <th className="th pl-5">Categoría</th>
            <th className="th text-right">Ventas hoy</th>
            <th className="th text-right">Valor stock</th>
            <th className="th text-right">En riesgo</th>
            <th className="th pr-5 text-right">Góndolas vacías</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {categories.map((c) => {
            const list = state.products.filter((p) => p.categoryId === c.id);
            const s = summarize(list, insights);
            return (
              <tr key={c.id} className="cursor-pointer hover:bg-page/50" onClick={() => onSelect(c.id)}>
                <td className="td pl-5">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: categoryColor(c.colorSlot) }} />
                    {c.emoji} {c.name}
                  </span>
                </td>
                <td className="td num text-right">{money(s.revenueToday)}</td>
                <td className="td num text-right">{moneyCompact(s.stockValue)}</td>
                <td className="td num text-right">
                  {s.riskCounts.critico + s.riskCounts.alto}/{s.count}
                </td>
                <td className="td num pr-5 text-right">{s.outOfShelf}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------- Vista de producto ---------------------------- */

function ProductView({ product: p, insight: i, metric, range, onBack }: { product: Product; insight: ProductInsight; metric: Metric; range: Range; onBack: () => void }) {
  const { state, insights, categoryById } = useStore();
  const { openMovement, openOrder } = useActions();
  const today = toDateKey(new Date(state.now));
  const c = categoryById[p.categoryId];
  const fmt = metric === 'revenue' ? axisMoney : axisNumber;
  const u = p.unit === 'kg' ? 'kg' : 'un.';

  const series = useMemo(
    () => buildSeries([p], state.history, state.todaySales, insights, metric, range, state.settings.horizonDays),
    [p, state.history, state.todaySales, insights, metric, range, state.settings.horizonDays],
  );
  const weekday = useMemo(() => weekdayProfile([p], state.history, metric), [p, state.history, metric]);
  const hourly = useMemo(() => hourlyToday([p], state.todayHourly, insights, metric), [p, state.todayHourly, insights, metric]);
  const moves = state.movements.filter((m) => m.productId === p.id).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="panel p-4 sm:p-5">
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Volver a {c?.name ?? 'la categoría'}
        </button>
        <div className="flex flex-wrap items-start gap-4">
          <ProductAvatar product={p} category={c} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight">{p.name}</h2>
              <RiskBadge risk={i.risk} label={`Riesgo ${RISK_LABEL[i.risk].toLowerCase()}`} />
              <ShelfBadge status={i.shelfStatus} />
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {c?.name} · {p.sku} · {p.location} · entrega {p.leadTimeDays} d · {p.packLabel} · {money(p.price)}
            </p>
            <p className="mt-3 flex gap-2 rounded-lg bg-tag-soft px-3 py-2 text-sm leading-relaxed text-ink">
              <span className="pt-0.5">
                <AiTag />
              </span>
              <span>{i.summary}</span>
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button className="btn-outline flex-1 sm:flex-none" onClick={() => openMovement({ productId: p.id, kind: 'venta', qty: 1 })}>
              <ShoppingCart size={15} aria-hidden /> Vender
            </button>
            <button className="btn-outline flex-1 sm:flex-none" onClick={() => openMovement({ productId: p.id, kind: 'reposicion', qty: i.shelfRefill || undefined })} disabled={p.stockAlmacen <= 0}>
              <ArrowRightLeft size={15} aria-hidden /> Reponer
            </button>
            <button className="btn-primary flex-1 sm:flex-none" onClick={() => openOrder([{ productId: p.id, qty: i.suggestedOrderQty || p.packSize }])}>
              <Truck size={15} aria-hidden /> Pedir
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Consumo promedio diario" value={`${number(i.avgDaily7)} ${u}`} sub={`28 días: ${number(i.avgDaily28)} · tendencia ${signedPercent(i.trendWeekly)}/sem`} />
        <Kpi label="Tiempo para agotarse" value={stockoutSpan(i)} sub={`Agota: ${stockoutWhen(i, today)}`} tone={i.risk} />
        <Kpi label="Reabastecimiento estimado" value={i.restockDate ? dayWord(i.restockDate, today) : '—'} sub={i.restockSource === 'pedido' ? 'Pedido en camino' : i.orderInDays === 0 ? 'Si se pide hoy' : `Pedir: ${orderWhen(i, today)}`} tone={i.gapBeforeRestock && i.onHand > 0 ? 'critico' : 'default'} />
        <Kpi label="Pedido sugerido" value={i.suggestedOrderQty ? `${number(i.suggestedOrderQty)} ${u}` : '—'} sub={i.suggestedOrderQty ? `${packText(p, i.suggestedPacks)} · ${orderWhen(i, today)}` : 'No requerido'} tone="brand" />
        <Kpi label="Probabilidad de quiebre" value={probability(i.stockoutProbability)} sub="Antes de la próxima reposición" tone={i.risk} />
        <Kpi label="Góndola" value={`${Math.round(i.gondolaPct * 100)} %`} sub={`Se vacía: ${gondolaWhen(i, today, p)}`} tone={i.shelfStatus === 'critico' ? 'critico' : i.shelfStatus === 'alerta' ? 'medio' : 'bajo'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Demanda: histórico y pronóstico" subtitle={`${range} días de historia + ${state.settings.horizonDays} días de pronóstico · ${metric === 'revenue' ? 'S/' : u}`} actions={<AiTag />}>
          <ForecastChart data={series} format={fmt} height={290} />
        </Panel>
        <Panel className="lg:col-span-2" title="Proyección de stock" subtitle={`Góndola + almacén con pedidos en camino · ${u}`} actions={<AiTag />}>
          <StockProjectionChart insight={i} days={Math.max(7, Math.min(state.settings.horizonDays, 21))} format={axisNumber} height={290} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Ventas de hoy por franja" subtitle={metric === 'revenue' ? 'S/' : u}>
          <HourlyChart data={hourly} currentSlot={hourSlot(new Date(state.now))} format={fmt} height={200} />
        </Panel>
        <Panel title="Estacionalidad semanal" subtitle={`Promedio de 4 semanas · ${metric === 'revenue' ? 'S/' : u}`}>
          <WeekdayChart values={weekday} highlight={weekdayIndex(today)} format={fmt} />
        </Panel>
        <Panel title="Modelo y parámetros" subtitle="Backtest fuera de muestra (7 días)">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Metric2 label="MAPE" value={`${number(i.quality.mape)} %`} good={i.quality.mape <= 20} />
            <Metric2 label="R² (ajuste)" value={number(i.model.r2)} />
            <Metric2 label="MAE" value={`${number(i.quality.mae)} ${u}`} />
            <Metric2 label="RMSE" value={`${number(i.quality.rmse)} ${u}`} />
            <Metric2 label="Stock de seguridad" value={`${number(i.safetyStock)} ${u}`} />
            <Metric2 label="Punto de reorden" value={`${number(i.reorderPoint)} ${u}`} />
            <Metric2 label="Corrección intradía" value={`× ${number(i.nowcast)}`} />
            <Metric2 label="Consumo por hora" value={`${number(i.hourlyRate)} ${u}`} />
          </dl>
        </Panel>
      </div>

      <Panel title="Últimos movimientos" subtitle="Kardex del producto" bodyClassName="p-0">
        {moves.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Sin movimientos registrados.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-line bg-page/60">
                <tr>
                  <th className="th pl-5">Fecha</th>
                  <th className="th">Tipo</th>
                  <th className="th text-right">Cantidad</th>
                  <th className="th">Detalle</th>
                  <th className="th pr-5 text-right">Góndola / Almacén</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {moves.map((m) => (
                  <tr key={m.id}>
                    <td className="td num pl-5 text-xs text-muted">{formatDateTime(m.ts)}</td>
                    <td className="td text-xs font-semibold">{m.type}</td>
                    <td className="td num text-right">{number(m.qty)}</td>
                    <td className="td text-xs text-muted">
                      {m.user}
                      {m.reason ? ` · ${m.reason}` : ''}
                    </td>
                    <td className="td num pr-5 text-right text-xs">
                      {number(m.gondolaAfter)} / {number(m.almacenAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-line px-5 py-2.5 text-right">
          <Link to="/ventas" className="text-xs font-semibold text-brand hover:underline">
            Ver kardex completo →
          </Link>
        </div>
      </Panel>
    </div>
  );
}

function Metric2({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg bg-page px-3 py-2">
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className={`num font-bold ${good === undefined ? 'text-ink' : good ? 'text-riskText-bajo' : 'text-riskText-alto'}`}>{value}</dd>
    </div>
  );
}

/** Variaciones de tono del color de la categoría para distinguir productos. */
function shade(hex: string, idx: number, total: number): string {
  const t = total <= 1 ? 0 : idx / (total - 1);
  const mix = -0.35 + t * 0.75; // de más oscuro a más claro
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(mix < 0 ? v * (1 + mix) : v + (255 - v) * mix));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
