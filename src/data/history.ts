import type { DailyPoint, SalesHistory } from '@/domain/types';
import { HOURLY_SHARE, cumulativeShare } from '@/engine/intraday';
import { addDays, toDateKey } from '@/lib/dates';
import { createRng, gaussian } from '@/lib/random';
import { DEMAND_PROFILES, INITIAL_PRODUCTS } from './catalog';
import { trueDailyDemand } from './demand';

export const HISTORY_DAYS = 56;

export interface GeneratedHistory {
  /** Días completos (cerrados), del más antiguo al más reciente; no incluye hoy. */
  history: SalesHistory;
  /** Ventas acumuladas de hoy hasta la hora actual. */
  todaySales: Record<string, number>;
  /** Ventas de hoy por franja horaria (15 franjas). */
  todayHourly: Record<string, number[]>;
}

const round = (v: number, unit: 'un' | 'kg') => (unit === 'kg' ? Math.round(v * 10) / 10 : Math.round(v));

/**
 * Genera el histórico simulado de ventas diarias de los últimos 56 días y las ventas de hoy hasta `now`.
 * Determinista: misma semilla y misma fecha → mismos datos.
 */
export function generateSalesHistory(now: Date = new Date(), seed = 3): GeneratedHistory {
  const rng = createRng(seed);
  const today = toDateKey(now);
  const start = addDays(today, -HISTORY_DAYS);
  const fraction = cumulativeShare(now);
  const unitById = new Map(INITIAL_PRODUCTS.map((p) => [p.id, p.unit]));

  const history: SalesHistory = {};
  const todaySales: Record<string, number> = {};
  const todayHourly: Record<string, number[]> = {};

  for (const productId of Object.keys(DEMAND_PROFILES)) {
    const unit = unitById.get(productId) ?? 'un';
    const points: DailyPoint[] = [];
    for (let i = 0; i < HISTORY_DAYS; i++) {
      const date = addDays(start, i);
      const noise = Math.max(0.55, 1 + gaussian(rng) * 0.16);
      const units = trueDailyDemand(productId, date, today) * noise;
      points.push({ date, units: Math.max(0, round(units, unit)) });
    }
    history[productId] = points;

    // Día en curso: solo lo vendido hasta ahora, repartido por franja horaria.
    const expectedToday = trueDailyDemand(productId, today, today) * Math.max(0.6, 1 + gaussian(rng) * 0.1);
    // Redondeo acumulado: evita perder las fracciones de cada franja en productos de baja rotación.
    let prev = 0;
    const hourly = HOURLY_SHARE.map((share, slot) => {
      const cum = round(expectedToday * Math.min(fraction, cumulativeBefore(slot) + share), unit);
      const v = Math.max(0, round(cum - prev, unit));
      prev = cum;
      return v;
    });
    todayHourly[productId] = hourly;
    todaySales[productId] = round(
      hourly.reduce((s, v) => s + v, 0),
      unit,
    );
  }
  return { history, todaySales, todayHourly };
}

function cumulativeBefore(slot: number): number {
  let acc = 0;
  for (let i = 0; i < slot; i++) acc += HOURLY_SHARE[i];
  return acc;
}
