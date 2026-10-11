import { diffDays, weekdayIndex } from '@/lib/dates';
import { DEMAND_PROFILES } from './catalog';

/**
 * "Demanda real" simulada de los clientes. La usa el generador del histórico y el simulador de ventas.
 * El motor predictivo NUNCA lee esta función: solo ve las ventas registradas, igual que en la tienda real.
 */
const DEFAULT_WEEKDAY = [0.9, 0.88, 0.92, 0.97, 1.1, 1.25, 1.0];

/** Factor de quincena: en Perú el gasto sube los días de pago (15 y fin de mes). */
export function paydayFactor(dateKey: string): number {
  const day = Number(dateKey.slice(8, 10));
  return day === 15 || day === 16 || day >= 30 || day === 1 ? 1.15 : 1;
}

/**
 * Demanda esperada (sin ruido) de un producto en una fecha.
 * `originKey` es el día en que arranca la simulación; la tendencia se mide desde ahí.
 */
export function trueDailyDemand(productId: string, dateKey: string, originKey: string): number {
  const profile = DEMAND_PROFILES[productId];
  if (!profile) return 0;
  const weekday = profile.weekday ?? DEFAULT_WEEKDAY;
  const weeks = diffDays(originKey, dateKey) / 7;
  const trend = Math.max(0.3, 1 + profile.weeklyTrend * weeks);
  return profile.base * weekday[weekdayIndex(dateKey)] * trend * paydayFactor(dateKey);
}

/** Tamaño medio de compra por cliente en productos a granel (kg). */
export const AVG_KG_BASKET = 0.8;
