import type { TooltipProps } from 'recharts';

type Row = { name: string; value: string; color?: string };

/** Tooltip compacto y consistente para todos los gráficos. */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
  title,
}: TooltipProps<number | number[], string> & { format?: (v: number, key: string) => string; title?: (label: string) => string }) {
  if (!active || !payload?.length) return null;
  const rows: Row[] = [];
  for (const item of payload) {
    if (item.value === null || item.value === undefined) continue;
    const key = String(item.dataKey ?? item.name ?? '');
    const v = item.value;
    const text = Array.isArray(v)
      ? `${format ? format(v[0], key) : v[0]} – ${format ? format(v[1], key) : v[1]}`
      : format
        ? format(Number(v), key)
        : String(v);
    rows.push({ name: String(item.name ?? key), value: text, color: (item.color as string) ?? (item.payload?.fill as string) });
  }
  if (!rows.length) return null;
  return (
    <div className="min-w-[160px] rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-pop">
      {label !== undefined && <div className="mb-1 font-semibold text-white/80">{title ? title(String(label)) : label}</div>}
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-white/75">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.name}
          </span>
          <span className="num font-semibold">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Leyenda manual (más legible que la de Recharts en móvil). */
export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean; area?: boolean }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.area ? (
            <span className="h-2.5 w-4 rounded-sm" style={{ background: it.color, opacity: 0.25 }} />
          ) : (
            <span className="w-4 border-t-2" style={{ borderColor: it.color, borderStyle: it.dashed ? 'dashed' : 'solid' }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

export const axisProps = {
  tick: { fontSize: 11, fill: '#8A909C' },
  tickLine: false,
  axisLine: false,
} as const;
