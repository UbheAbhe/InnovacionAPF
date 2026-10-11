import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SeriesPoint } from '@/engine/aggregate';
import { CHART } from '@/lib/colors';
import { ChartLegend, ChartTooltip, axisProps } from './ChartTooltip';

const NAMES: Record<string, string> = { actual: 'Venta real', fitted: 'Ajuste del modelo', expected: 'Pronóstico', band: 'Intervalo 80 %' };

/** Histórico de ventas + ajuste del modelo + pronóstico con banda de confianza. */
export function ForecastChart({
  data,
  format,
  height = 280,
  compact = false,
}: {
  data: SeriesPoint[];
  format: (v: number) => string;
  height?: number;
  compact?: boolean;
}) {
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: compact ? -12 : 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...axisProps} width={compact ? 40 : 56} tickFormatter={(v) => format(v)} />
            <Tooltip content={<ChartTooltip format={(v) => format(v)} />} />
            <Area dataKey="band" name={NAMES.band} stroke="none" fill={CHART.band} fillOpacity={0.12} isAnimationActive={false} />
            <Line dataKey="fitted" name={NAMES.fitted} stroke={CHART.fitted} strokeDasharray="2 3" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            <Line dataKey="actual" name={NAMES.actual} stroke={CHART.actual} strokeWidth={2} dot={(p) => renderTodayDot(p)} isAnimationActive={false} />
            <Line dataKey="expected" name={NAMES.expected} stroke={CHART.forecast} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <ReferenceLine x="Hoy" stroke={CHART.muted} strokeDasharray="3 3" label={{ value: 'Hoy', position: 'insideTopRight', fontSize: 11, fill: CHART.muted }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { label: 'Venta real', color: CHART.actual },
          { label: 'Ajuste del modelo', color: CHART.fitted, dashed: true },
          { label: 'Pronóstico', color: CHART.forecast, dashed: true },
          { label: 'Intervalo 80 %', color: CHART.band, area: true },
        ]}
      />
    </div>
  );
}

// Punto destacado para la venta parcial de hoy.
function renderTodayDot(props: { cx?: number; cy?: number; payload?: SeriesPoint; index?: number }) {
  const { cx, cy, payload, index } = props;
  if (!payload?.isToday || cx === undefined || cy === undefined) return <g key={`d-${index}`} />;
  return <circle key={`d-${index}`} cx={cx} cy={cy} r={4} fill="#fff" stroke={CHART.actual} strokeWidth={2} />;
}
