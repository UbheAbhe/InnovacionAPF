import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import type { HourlyPoint } from '@/engine/aggregate';
import { HOUR_LABELS } from '@/engine/intraday';
import { CHART } from '@/lib/colors';
import { ChartLegend, ChartTooltip, axisProps } from './ChartTooltip';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Venta promedio por día de semana (estacionalidad semanal). */
export function WeekdayChart({ values, highlight, format, height = 200 }: { values: number[]; highlight?: number; format: (v: number) => string; height?: number }) {
  const data = values.map((v, i) => ({ day: WEEKDAYS[i], value: v, i }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="day" {...axisProps} />
          <YAxis {...axisProps} width={44} tickFormatter={(v) => format(v)} />
          <Tooltip cursor={{ fill: '#F1F3F5' }} content={<ChartTooltip format={(v) => format(v)} />} />
          <Bar dataKey="value" name="Promedio" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.i} fill={d.i === highlight ? CHART.forecast : '#C9CED6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Venta de hoy por franja horaria vs. distribución esperada. */
export function HourlyChart({ data, currentSlot, format, height = 220 }: { data: HourlyPoint[]; currentSlot: number; format: (v: number) => string; height?: number }) {
  const rows = data.map((d) => ({ ...d, label: HOUR_LABELS[d.slot], actual: d.slot <= currentSlot ? d.actual : null }));
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} interval={1} />
            <YAxis {...axisProps} width={44} tickFormatter={(v) => format(v)} />
            <Tooltip cursor={{ fill: '#F1F3F5' }} content={<ChartTooltip format={(v) => format(v)} />} />
            <Bar dataKey="actual" name="Vendido" fill={CHART.ink} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line dataKey="expected" name="Esperado" stroke={CHART.forecast} strokeDasharray="4 3" strokeWidth={2} dot={false} isAnimationActive={false} />
            {currentSlot >= 0 && currentSlot < HOUR_LABELS.length && (
              <ReferenceLine x={HOUR_LABELS[currentSlot]} stroke={CHART.muted} strokeDasharray="3 3" label={{ value: 'Ahora', position: 'insideTopRight', fontSize: 10, fill: CHART.muted }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={[{ label: 'Vendido', color: CHART.ink }, { label: 'Esperado por franja', color: CHART.forecast, dashed: true }]} />
    </div>
  );
}

export interface PieDatum {
  name: string;
  value: number;
  color: string;
}

/** Gráfico de pastel (dona) con total al centro. */
export function DonutChart({ data, centerLabel, centerValue, format, height = 200 }: { data: PieDatum[]; centerLabel: string; centerValue: string; format: (v: number) => string; height?: number }) {
  const visible = data.filter((d) => d.value > 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={visible.length ? visible : [{ name: 'Sin datos', value: 1, color: '#E2E5EA' }]} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={visible.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
            {(visible.length ? visible : [{ name: 'Sin datos', value: 1, color: '#E2E5EA' }]).map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          {visible.length > 0 && <Tooltip content={<ChartTooltip format={(v) => format(v)} />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="figure text-2xl text-ink">{centerValue}</span>
        <span className="text-[11px] text-muted">{centerLabel}</span>
      </div>
    </div>
  );
}

export function PieLegend({ data, format }: { data: PieDatum[]; format: (v: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <ul className="space-y-1.5 text-xs">
      {data.map((d) => (
        <li key={d.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
          <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
          <span className="num font-semibold text-ink">{format(d.value)}</span>
          <span className="num w-10 text-right text-muted">{Math.round((d.value / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Barras horizontales por categoría o producto. */
export function HBarChart({
  data,
  format,
  height,
  onSelect,
  reference,
}: {
  data: { name: string; value: number; color: string; id?: string }[];
  format: (v: number) => string;
  height?: number;
  onSelect?: (id: string) => void;
  reference?: { value: number; label: string };
}) {
  const h = height ?? Math.max(160, data.length * 30 + 20);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" {...axisProps} tickFormatter={(v) => format(v)} />
          <YAxis type="category" dataKey="name" {...axisProps} width={118} tick={{ fontSize: 11, fill: '#3A3F4A' }} />
          <Tooltip cursor={{ fill: '#F1F3F5' }} content={<ChartTooltip format={(v) => format(v)} />} />
          <Bar
            dataKey="value"
            name="Valor"
            radius={[0, 4, 4, 0]}
            barSize={16}
            isAnimationActive={false}
            onClick={(d: { id?: string }) => d.id && onSelect?.(d.id)}
            className={onSelect ? 'cursor-pointer' : ''}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
          {reference && <ReferenceLine x={reference.value} stroke={CHART.muted} strokeDasharray="3 3" label={{ value: reference.label, position: 'top', fontSize: 10, fill: CHART.muted }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ingresos diarios (área). */
export function TrendArea({ data, format, height = 220, color = CHART.ink }: { data: { label: string; value: number; lost?: number }[]; format: (v: number) => string; height?: number; color?: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
          <YAxis {...axisProps} width={56} tickFormatter={(v) => format(v)} />
          <Tooltip content={<ChartTooltip format={(v) => format(v)} />} />
          <Area dataKey="value" name="Ventas" stroke={color} strokeWidth={2} fill="url(#trendFill)" isAnimationActive={false} />
          {data.some((d) => d.lost) && <Area dataKey="lost" name="Ventas perdidas" stroke={CHART.forecast} strokeWidth={1.5} fill={CHART.forecast} fillOpacity={0.08} isAnimationActive={false} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
