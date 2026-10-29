import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProductInsight } from '@/engine/inventory';
import { formatDayShort } from '@/lib/dates';
import { CHART } from '@/lib/colors';
import { ChartLegend, ChartTooltip, axisProps } from './ChartTooltip';

/** Proyección del stock total frente al punto de reorden y el stock de seguridad. */
export function StockProjectionChart({
  insight,
  days,
  format,
  height = 260,
}: {
  insight: ProductInsight;
  days: number;
  format: (v: number) => string;
  height?: number;
}) {
  const data = [
    { label: 'Ahora', stock: insight.onHand },
    ...insight.projection.slice(0, days).map((p, i) => ({
      label: i === 0 ? 'Cierre hoy' : formatDayShort(p.date),
      stock: p.stock,
      arrivals: p.arrivals,
    })),
  ];
  const arrivals = insight.projection.slice(0, days).flatMap((p, i) => (p.arrivals > 0 && i > 0 ? [formatDayShort(p.date)] : []));
  const stockoutIdx = insight.stockoutDate ? insight.projection.findIndex((p) => p.date === insight.stockoutDate) : -1;
  const stockoutLabel = stockoutIdx > 0 && stockoutIdx < days ? formatDayShort(insight.projection[stockoutIdx].date) : stockoutIdx === 0 ? 'Cierre hoy' : null;

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.actual} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CHART.actual} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} width={48} tickFormatter={(v) => format(v)} domain={[0, (max: number) => Math.ceil(Math.max(max, insight.reorderPoint * 1.15))]} />
            <Tooltip content={<ChartTooltip format={(v) => format(v)} />} />
            <Area type="linear" dataKey="stock" name="Stock proyectado" stroke={CHART.actual} strokeWidth={2} fill="url(#stockFill)" isAnimationActive={false} />
            <ReferenceLine y={insight.reorderPoint} stroke="#E8890C" strokeDasharray="5 4" label={{ value: 'Punto de reorden', position: 'insideTopLeft', fontSize: 10, fill: '#94500A' }} />
            <ReferenceLine y={insight.safetyStock} stroke="#C62828" strokeDasharray="2 3" label={{ value: 'Stock de seguridad', position: 'insideBottomLeft', fontSize: 10, fill: '#A11D1D' }} />
            {arrivals.map((x) => (
              <ReferenceLine key={x} x={x} stroke="#1E9B4B" label={{ value: 'Llega pedido', position: 'top', fontSize: 10, fill: '#14703A' }} />
            ))}
            {stockoutLabel && (
              <ReferenceLine x={stockoutLabel} stroke="#C62828" strokeWidth={2} label={{ value: 'Quiebre', position: 'top', fontSize: 10, fill: '#A11D1D' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { label: 'Stock proyectado (góndola + almacén)', color: CHART.actual },
          { label: 'Punto de reorden', color: '#E8890C', dashed: true },
          { label: 'Stock de seguridad', color: '#C62828', dashed: true },
        ]}
      />
    </div>
  );
}
