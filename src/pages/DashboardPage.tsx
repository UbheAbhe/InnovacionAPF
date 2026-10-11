import { ArrowRight, ArrowRightLeft, Bell, BrainCircuit, CircleDollarSign, Gauge, PackageX, Plus, ShoppingCart, TriangleAlert, Truck } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { DonutChart, HBarChart, HourlyChart, PieLegend } from '@/components/charts/SimpleCharts';
import { useActions } from '@/components/inventory/ActionsProvider';
import { gondolaWhen, stockoutWhen } from '@/components/inventory/labels';
import { PageHeader } from '@/components/layout/AppShell';
import { AiTag, RiskBadge, RiskDot, ShelfBadge } from '@/components/ui/Badges';
import { Kpi } from '@/components/ui/Kpi';
import { Panel } from '@/components/ui/Panel';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { StockBar } from '@/components/ui/StockBar';
import { buildSeries, hourlyToday, summarize } from '@/engine/aggregate';
import { hourSlot } from '@/engine/intraday';
import { categoryColor, RISK_COLOR, RISK_LABEL, RISK_ORDER, SHELF_COLOR, SHELF_LABEL } from '@/lib/colors';
import { toDateKey } from '@/lib/dates';
import { axisMoney, integer, money, moneyCompact, number, percent, qty } from '@/lib/format';
import { useStore } from '@/store/StoreProvider';

export default function DashboardPage() {
  const { state, insights, alerts, categories, categoryById } = useStore();
  const { openMovement } = useActions();
  const navigate = useNavigate();
  const { products } = state;
  const today = toDateKey(new Date(state.now));

  const s = useMemo(() => summarize(products, insights), [products, insights]);
  const lostTodayAmount = products.reduce((acc, p) => acc + (state.lostToday[p.id] ?? 0) * p.price, 0);
  const pendingOrders = state.orders.filter((o) => o.status === 'pendiente').length;
  const atRisk = s.riskCounts.critico + s.riskCounts.alto;

  const series = useMemo(
    () => buildSeries(products, state.history, state.todaySales, insights, 'revenue', 21, 7),
    [products, state.history, state.todaySales, insights],
  );
  const hourly = useMemo(() => hourlyToday(products, state.todayHourly, insights, 'revenue'), [products, state.todayHourly, insights]);

  const riskData = RISK_ORDER.map((r) => ({ name: RISK_LABEL[r], value: s.riskCounts[r], color: RISK_COLOR[r] }));
  const byCategory = categories.map((c) => {
    const list = products.filter((p) => p.categoryId === c.id);
    return { id: c.id, name: c.name, value: list.reduce((acc, p) => acc + (state.todaySales[p.id] ?? 0) * p.price, 0), color: categoryColor(c.colorSlot) };
  });

  const refillList = products
    .filter((p) => insights[p.id]?.shelfStatus !== 'optimo')
    .sort((a, b) => insights[a.id].gondolaHoursLeft - insights[b.id].gondolaHoursLeft)
    .slice(0, 5);
  const nextStockouts = products
    .filter((p) => Number.isFinite(insights[p.id]?.daysToStockout))
    .sort((a, b) => insights[a.id].daysToStockout - insights[b.id].daysToStockout)
    .slice(0, 6);
  const topAlerts = alerts.slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Estado de la sucursal Av. Tantamayo en tiempo real. Inicia la simulación de ventas para ver cómo reaccionan las alertas, los gráficos y las predicciones."
        actions={
          <>
            <Link to="/alertas" className="btn-outline">
              <Bell size={16} aria-hidden /> Alertas
            </Link>
            <button className="btn-primary" onClick={() => openMovement()}>
              <Plus size={16} aria-hidden /> Registrar movimiento
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Ventas de hoy" value={moneyCompact(s.revenueToday)} sub={<>Esperado al cierre: <strong className="text-ink">{moneyCompact(s.expectedRevenueToday)}</strong></>} icon={CircleDollarSign} tone="brand" onClick={() => navigate('/ventas')} />
        <Kpi label="Productos en riesgo" value={`${atRisk}/${s.count}`} sub={`${s.riskCounts.critico} críticos · ${s.riskCounts.alto} altos`} icon={TriangleAlert} tone={atRisk > 0 ? 'critico' : 'bajo'} onClick={() => navigate('/prediccion')} />
        <Kpi label="Góndolas vacías" value={integer(s.outOfShelf)} sub={`Tasa de quiebre: ${percent(s.outOfShelf / Math.max(1, s.count), 1)}`} icon={PackageX} tone={s.outOfShelf > 0 ? 'alto' : 'bajo'} onClick={() => navigate('/productos')} />
        <Kpi label="Ventas perdidas hoy" value={money(lostTodayAmount)} sub={`Acumulado simulación: ${money(state.lost.amount)}`} icon={ShoppingCart} tone={lostTodayAmount > 0 ? 'critico' : 'default'} />
        <Kpi label="Pedidos sugeridos hoy" value={integer(s.ordersNeeded)} sub={`${pendingOrders} pedidos en camino`} icon={Truck} tone={s.ordersNeeded > 0 ? 'medio' : 'default'} onClick={() => navigate('/prediccion')} />
        <Kpi label="Error del pronóstico" value={`${number(s.avgMape)} %`} sub={<>MAPE promedio · meta ≤ 20 %</>} icon={Gauge} tone={s.avgMape <= 20 ? 'bajo' : 'medio'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Semáforo de góndola" subtitle="Rojo ≤ 30 % · Ámbar 31–60 % · Verde > 60 % de la capacidad">
          <div className="grid grid-cols-3 gap-2">
            {(['critico', 'alerta', 'optimo'] as const).map((k) => (
              <div key={k} className="rounded-xl p-3" style={{ background: `${SHELF_COLOR[k]}14` }}>
                <div className="figure text-3xl" style={{ color: SHELF_COLOR[k] }}>
                  {s.shelfCounts[k]}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-ink-soft">{SHELF_LABEL[k]}</div>
              </div>
            ))}
          </div>
          <h3 className="mb-2 mt-5 text-xs font-semibold text-muted">Reponer primero</h3>
          {refillList.length === 0 ? (
            <p className="text-sm text-muted">Todas las góndolas están abastecidas.</p>
          ) : (
            <ul className="space-y-2.5">
              {refillList.map((p) => {
                const i = insights[p.id];
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <ProductAvatar product={p} category={categoryById[p.categoryId]} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/analisis?p=${p.id}`} className="truncate text-sm font-semibold hover:underline">
                          {p.name}
                        </Link>
                        <span className="num shrink-0 text-xs text-muted">{gondolaWhen(i, today, p)}</span>
                      </div>
                      <StockBar pct={i.gondolaPct} status={i.shelfStatus} className="mt-1.5" />
                    </div>
                    <button
                      className="btn-outline h-8 shrink-0 px-2"
                      onClick={() => openMovement({ productId: p.id, kind: 'reposicion', qty: i.shelfRefill })}
                      disabled={p.stockAlmacen <= 0}
                      title={p.stockAlmacen > 0 ? `Bajar ${number(i.shelfRefill)} del almacén` : 'Sin stock en almacén'}
                      aria-label={`Reponer ${p.name}`}
                    >
                      <ArrowRightLeft size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Riesgo de desabastecimiento" subtitle="Probabilidad de quiebre antes de la próxima reposición" actions={<AiTag />}>
          <DonutChart data={riskData} centerValue={String(s.count)} centerLabel="productos" format={(v) => `${v} productos`} />
          <div className="mt-3">
            <PieLegend data={riskData} format={(v) => String(v)} />
          </div>
        </Panel>

        <Panel title="Ventas de hoy por categoría" subtitle="Soles vendidos hasta la hora actual">
          <HBarChart data={byCategory} format={axisMoney} onSelect={(id) => navigate(`/analisis?cat=${id}`)} />
          <p className="mt-2 text-[11px] text-faint">Toca una barra para analizar la categoría.</p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Ventas por franja horaria (hoy)" subtitle="Venta real frente a la distribución esperada del día · S/">
          <HourlyChart data={hourly} currentSlot={hourSlot(new Date(state.now))} format={axisMoney} />
        </Panel>
        <Panel
          title="Prioridades"
          subtitle={`${alerts.length} alertas activas`}
          actions={
            <Link to="/alertas" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              Ver todas <ArrowRight size={13} aria-hidden />
            </Link>
          }
          bodyClassName="p-0"
        >
          {topAlerts.length === 0 ? (
            <p className="p-5 text-sm text-muted">Sin alertas. ¡Todo en orden!</p>
          ) : (
            <ul className="divide-y divide-line">
              {topAlerts.map((a) => (
                <li key={a.id} className="flex gap-3 px-4 py-3 sm:px-5">
                  <span className="mt-1.5">
                    <RiskDot risk={a.severity === 'info' ? 'bajo' : a.severity} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-ink">{a.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Ventas de la tienda y pronóstico"
          subtitle="Últimos 21 días y próximos 7 · S/ · tendencia lineal con estacionalidad semanal"
          actions={<AiTag />}
        >
          <ForecastChart data={series} format={axisMoney} />
        </Panel>
        <Panel
          title="Próximos agotamientos"
          subtitle="Según la proyección de consumo y pedidos en camino"
          actions={
            <Link to="/prediccion" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              <BrainCircuit size={13} aria-hidden /> Módulo predictivo
            </Link>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-line">
            {nextStockouts.map((p) => {
              const i = insights[p.id];
              return (
                <li key={p.id}>
                  <Link to={`/analisis?p=${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-page sm:px-5">
                    <ProductAvatar product={p} category={categoryById[p.categoryId]} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-muted">
                        Stock {qty(i.onHand, p.unit)} · <ShelfBadge status={i.shelfStatus} size="xs" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-sm font-bold">{stockoutWhen(i, today)}</div>
                      <RiskBadge risk={i.risk} size="xs" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
