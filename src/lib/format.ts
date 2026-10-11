import type { Unit } from '@/domain/types';

const pen = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });
const penCompact = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });

export const money = (v: number) => pen.format(v);
export const moneyCompact = (v: number) => (Math.abs(v) >= 10_000 ? penCompact.format(v) : pen.format(v));
export const number = (v: number) => num.format(v);
export const integer = (v: number) => int.format(Math.round(v));
export const percent = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;

export function qty(v: number, unit: Unit): string {
  return `${number(v)} ${unit === 'kg' ? 'kg' : 'un.'}`;
}

export function days(v: number): string {
  if (!Number.isFinite(v)) return 'Más de 60 días';
  if (v < 1) {
    const h = Math.max(0, v * 24);
    return h < 1 ? 'Menos de 1 h' : `${Math.round(h)} h`;
  }
  return `${number(v)} días`;
}

export function hours(v: number): string {
  if (!Number.isFinite(v)) return 'Sin consumo';
  if (v < 1) return `${Math.max(0, Math.round(v * 60))} min`;
  if (v > 48) return `${Math.round(v / 24)} días`;
  return `${number(v)} h`;
}

export function signedPercent(v: number): string {
  const p = Math.round(v * 100);
  return `${p > 0 ? '+' : ''}${p}%`;
}

/** Etiquetas compactas para ejes de gráficos. */
export function axisMoney(v: number): string {
  if (Math.abs(v) >= 1000) return `S/${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `S/${Math.round(v)}`;
}
export function axisNumber(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return Math.abs(v) < 10 ? number(v) : integer(v);
}

export function probability(p: number): string {
  if (p >= 0.995) return '>99 %';
  if (p > 0 && p < 0.01) return '<1 %';
  return `${Math.round(p * 100)} %`;
}
