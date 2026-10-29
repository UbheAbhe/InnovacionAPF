import { CircleDollarSign, Download, Percent, Receipt, ScanBarcode, ShoppingCart, TrendingUp, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DonutChart, HBarChart, HourlyChart, PieLegend, TrendArea } from '@/components/charts/SimpleCharts';
import { PageHeader } from '@/components/layout/AppShell';
import { Kpi, KpiStrip } from '@/components/ui/Kpi';
import { Panel } from '@/components/ui/Panel';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import type { MovementType } from '@/domain/types';
import { dailyRevenue, hourlyToday } from '@/engine/aggregate';
import { hourSlot } from '@/engine/intraday';
import { categoryColor } from '@/lib/colors';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatDayShort, toDateKey } from '@/lib/dates';
import { axisMoney, integer, money, moneyCompact, number, percent, signedPercent } from '@/lib/format';
import { matchesFilters } from '@/store/hooks';
import { useStore } from '@/store/StoreProvider';

const TYPE_STYLE: Record<MovementType, string> = {
  VENTA: 'bg-[#E8EBF6] text-navy',
  ENTRADA: 'bg-riskBg-bajo text-riskText-bajo',
  REPOSICION: 'bg-tag-soft text-ink',
  MERMA: 'bg-riskBg-critico text-riskText-critico',
  AJUSTE: 'bg-page text-ink-soft',
};

export default function SalesPage() {
  const { state, insights, categories, categoryById, productById } = useStore();
  const { products } = state;
  const today = toDateKey(new Date(state.now));

  const revenueToday = products.reduce((a, p) => a + (state.todaySales[p.id] ?? 0) * p.price, 0);
  const marginToday = products.reduce((a, p) => a + (state.todaySales[p.id] ?? 0) * (p.price - p.cost), 0);
  const unitsToday = products.filter((p) => p.unit === 'un').reduce((a, p) => a + (state.todaySales[p.id] ?? 0), 0);
  const kgToday = products.filter((p) => p.unit === 'kg').reduce((a, p) => a + (state.todaySales[p.id] ?? 0), 0);
  const lostToday = products.reduce((a, p) => a + (state.lostToday[p.id] ?? 0) * p.price, 0);

  const daily = useMemo(() => dailyRevenue(products, state.history, 28), [products, state.history]);
  const last7 = daily.slice(-7).reduce((a, d) => a + d.revenue, 0);
  const prev7 = daily.slice(-14, -7).reduce((a, d) => a + d.revenue, 0);
  const lostByDate = new Map(state.dayCloses.map((d) => [d.date, d.lostAmount]));
  const trend = [
    ...daily.map((d) => ({ label: formatDayShort(d.date), value: d.revenue, lost: lostByDate.get(d.date) ?? 0 })),
    { label: 'Hoy', value: revenueToday, lost: lostToday },
  ];

  const byCategory = categories
    .map((c) => ({
      name: c.name,
      color: categoryColor(c.colorSlot),
      value: products.filter((p) => p.categoryId === c.id).reduce((a, p) => a + (state.history[p.id] ?? []).slice(-7).reduce((x, d) => x + d.units, 0) * p.price, 0),
    }))
    .sort((a, b) => b.value - a.value);

  const top = products
    .map((p) => ({
      id: p.id,
      name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name,
      value: (state.history[p.id] ?? []).slice(-7).reduce((x, d) => x + d.units, 0) * p.price + (state.todaySales[p.id] ?? 0) * p.price,
      color: categoryColor(categoryById[p.categoryId]?.colorSlot ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const hourly = useMemo(() => hourlyToday(products, state.todayHourly, insights, 'revenue'), [products, state.todayHourly, insights]);
  const lastClose = state.dayCloses[state.dayCloses.length - 1];

  return (
    <>
      <PageHeader
        title="Ventas y kardex"
        description="Métricas de las ventas simuladas, caja rápida para simular ventas y registro completo de movimientos exportable a Excel (US7)."
      />

      <KpiStrip className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Ventas de hoy" value={moneyCompact(revenueToday)} sub={`${integer(unitsToday)} un. · ${number(kgToday)} kg`} icon={CircleDollarSign} tone="brand" />
        <Kpi label="Margen bruto hoy" value={moneyCompact(marginToday)} sub={`${percent(revenueToday ? marginToday / revenueToday : 0, 1)} sobre ventas`} icon={Percent} />
        <Kpi label="Últimos 7 días" value={moneyCompact(last7)} sub={`${signedPercent(prev7 ? last7 / prev7 - 1 : 0)} vs. 7 días previos`} icon={TrendingUp} tone={last7 >= prev7 ? 'bajo' : 'alto'} />
        <Kpi label="Ventas perdidas hoy" value={money(lostToday)} sub="Demanda sin stock en góndola" icon={TriangleAlert} tone={lostToday > 0 ? 'critico' : 'default'} />
        <Kpi label="Ventas perdidas (simulación)" value={money(state.lost.amount)} sub={`${number(state.lost.units)} unidades/kg acumuladas`} icon={ShoppingCart} tone={state.lost.amount > 0 ? 'alto' : 'default'} />
        <Kpi
          label="Tasa de quiebre al cierre"
          value={lastClose ? percent(lastClose.skusOut / lastClose.skusTotal, 1) : '—'}
          sub={lastClose ? `${lastClose.skusOut} SKU en cero (${formatDayShort(lastClose.date)})` : 'Cierra un día en el simulador'}
          icon={Receipt}
        />
      </KpiStrip>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <QuickPos />
        <Panel className="lg:col-span-2" title="Ventas diarias" subtitle="Últimos 28 días + hoy (parcial) · S/">
          <TrendArea data={trend} format={axisMoney} height={250} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Ventas por categoría" subtitle="Últimos 7 días · S/">
          <DonutChart data={byCategory} centerValue={moneyCompact(byCategory.reduce((a, d) => a + d.value, 0))} centerLabel="7 días" format={money} />
          <div className="mt-3">
            <PieLegend data={byCategory} format={moneyCompact} />
          </div>
        </Panel>
        <Panel title="Top 10 productos" subtitle="Ingresos últimos 7 días + hoy · S/">
          <HBarChart data={top} format={axisMoney} />
        </Panel>
        <Panel title="Ventas por hora (hoy)" subtitle="S/ · real vs. esperado">
          <HourlyChart data={hourly} currentSlot={hourSlot(new Date(state.now))} format={axisMoney} height={240} />
        </Panel>
      </div>

      {state.dayCloses.length > 0 && (
        <Panel className="mt-4" title="Cierres diarios de la simulación" subtitle="Indicadores del informe: ventas, ventas perdidas y tasa de quiebre" bodyClassName="p-0">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-line bg-page/60">
                <tr>
                  <th className="th pl-5">Día</th>
                  <th className="th text-right">Ventas</th>
                  <th className="th text-right">Ventas perdidas</th>
                  <th className="th pr-5 text-right">Tasa de quiebre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...state.dayCloses].reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="td pl-5">{formatDayShort(d.date)}</td>
                    <td className="td num text-right">{money(d.revenue)}</td>
                    <td className="td num text-right">{money(d.lostAmount)}</td>
                    <td className="td num pr-5 text-right">
                      {percent(d.skusOut / d.skusTotal, 1)} ({d.skusOut} SKU)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Kardex today={today} productById={productById} />
    </>
  );
}

function QuickPos() {
  const { state, dispatch, productById, categoryById } = useStore();
  const toast = useToast();
  const [pid, setPid] = useState(state.products[0]?.id ?? '');
  const [amount, setAmount] = useState(1);
  const p = productById[pid];
  if (!p) return null;
  const u = p.unit === 'kg' ? 'kg' : 'un.';
  const steps = p.unit === 'kg' ? [0.5, 1, 2, 5] : [1, 2, 6, 12];

  const sell = () => {
    if (amount <= 0) return;
    const lost = Math.max(0, amount - p.stockGondola);
    dispatch({ type: 'SELL', productId: p.id, qty: amount });
    toast(
      lost > 0 ? `${p.name}: se vendieron ${number(amount - lost)} ${u}; ${number(lost)} ${u} no se atendieron (góndola vacía).` : `Venta: ${number(amount)} ${u} de ${p.name} · ${money(amount * p.price)}`,
      lost > 0 ? 'warning' : 'success',
    );
  };

  return (
    <Panel title="Caja rápida" subtitle="Simula una venta y mira cómo cambian stock, alertas y predicciones">
      <label className="block">
        <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted">
          <ScanBarcode size={13} aria-hidden /> Producto
        </span>
        <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
          {state.products.map((x) => (
            <option key={x.id} value={x.id}>
              {x.emoji} {x.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex items-center gap-3 rounded-lg bg-page p-3">
        <ProductAvatar product={p} category={categoryById[p.categoryId]} />
        <div className="flex-1 text-xs text-muted">
          Góndola <strong className="num text-ink">{number(p.stockGondola)} {u}</strong> · Precio <strong className="num text-ink">{money(p.price)}</strong>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input className="input num w-24 text-lg font-bold" type="number" min={0} step={p.unit === 'kg' ? 0.1 : 1} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} aria-label="Cantidad" />
        <Segmented<number> value={steps.includes(amount) ? amount : -1} onChange={setAmount} options={steps.map((s) => ({ value: s, label: `${number(s)}` }))} ariaLabel="Cantidad rápida" />
      </div>
      <button className="btn-brand mt-4 w-full" onClick={sell} disabled={amount <= 0}>
        <ShoppingCart size={16} aria-hidden /> Cobrar {money(amount * p.price)}
      </button>
    </Panel>
  );
}

function Kardex({ today, productById }: { today: string; productById: ReturnType<typeof useStore>['productById'] }) {
  const { state, insights, categoryById } = useStore();
  const [type, setType] = useState<MovementType | 'all'>('all');
  const [limit, setLimit] = useState(40);
  const rows = state.movements.filter((m) => {
    if (type !== 'all' && m.type !== type) return false;
    const p = productById[m.productId];
    return p && matchesFilters(p, insights[p.id], { ...state.filters, risk: state.filters.risk }, categoryById[p.categoryId]?.name);
  });

  const exportCsv = () =>
    downloadCsv(
      `kardex-3a-${today}.csv`,
      rows.map((m) => ({
        Fecha: formatDateTime(m.ts),
        Tipo: m.type,
        SKU: productById[m.productId]?.sku ?? '',
        Producto: productById[m.productId]?.name ?? m.productId,
        Cantidad: m.qty,
        'Importe (S/)': m.amount ? m.amount.toFixed(2) : '',
        'Góndola después': m.gondolaAfter,
        'Almacén después': m.almacenAfter,
        Usuario: m.user,
        Detalle: m.reason ?? '',
      })),
    );

  return (
    <Panel
      className="mt-4"
      title="Kardex de movimientos"
      subtitle={`${rows.length} registros · respeta la búsqueda y filtros globales`}
      actions={
        <>
          <div className="no-scrollbar max-w-full overflow-x-auto">
            <Segmented<MovementType | 'all'>
              value={type}
              onChange={setType}
              size="xs"
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'VENTA', label: 'Ventas' },
                { value: 'ENTRADA', label: 'Entradas' },
                { value: 'REPOSICION', label: 'Reposición' },
                { value: 'MERMA', label: 'Mermas' },
                { value: 'AJUSTE', label: 'Ajustes' },
              ]}
            />
          </div>
          <button className="btn-outline h-8 px-3 text-xs" onClick={exportCsv} disabled={rows.length === 0}>
            <Download size={14} aria-hidden /> Exportar CSV
          </button>
        </>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-line bg-page/60">
            <tr>
              <th className="th pl-5">Fecha</th>
              <th className="th">Tipo</th>
              <th className="th">Producto</th>
              <th className="th text-right">Cantidad</th>
              <th className="th text-right">Importe</th>
              <th className="th">Usuario / detalle</th>
              <th className="th pr-5 text-right">Góndola / Almacén</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, limit).map((m) => {
              const p = productById[m.productId];
              return (
                <tr key={m.id}>
                  <td className="td num whitespace-nowrap pl-5 text-xs text-muted">{formatDateTime(m.ts)}</td>
                  <td className="td">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${TYPE_STYLE[m.type]}`}>{m.type}</span>
                  </td>
                  <td className="td">
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{p?.emoji}</span>
                      <span className="truncate font-medium">{p?.name}</span>
                    </span>
                  </td>
                  <td className="td num text-right font-semibold">{number(m.qty)}</td>
                  <td className="td num text-right">{m.amount ? money(m.amount) : '—'}</td>
                  <td className="td text-xs text-muted">
                    {m.user}
                    {m.reason ? ` · ${m.reason}` : ''}
                  </td>
                  <td className="td num pr-5 text-right text-xs">
                    {number(m.gondolaAfter)} / {number(m.almacenAfter)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="border-t border-line p-3 text-center">
          <button className="btn-ghost text-xs" onClick={() => setLimit((l) => l + 60)}>
            Mostrar más ({rows.length - limit} restantes)
          </button>
        </div>
      )}
    </Panel>
  );
}
