import type { Product, RiskLevel, SalesHistory, ShelfStatus } from '@/domain/types';
import { formatDayShort, weekdayIndex } from '@/lib/dates';
import { predictForDate } from './forecast';
import type { ProductInsight } from './inventory';
import { HOURLY_SHARE } from './intraday';
import { mean } from './stats';

/**
 * Agregaciones para el módulo de análisis: combinan productos individuales en series de categoría
 * o de toda la tienda. Al sumar en soles se pueden mezclar unidades distintas (kg y unidades).
 */
export type Metric = 'units' | 'revenue';

export interface SeriesPoint {
  date: string;
  label: string;
  /** Venta real (hoy: parcial hasta la hora actual). */
  actual: number | null;
  /** Ajuste del modelo sobre el histórico. */
  fitted: number | null;
  /** Pronóstico (hoy en adelante). */
  expected: number | null;
  band: [number, number] | null;
  isToday: boolean;
}

const factorOf = (p: Product, metric: Metric) => (metric === 'revenue' ? p.price : 1);

export function buildSeries(
  products: Product[],
  history: SalesHistory,
  todaySales: Record<string, number>,
  insights: Record<string, ProductInsight>,
  metric: Metric,
  pastDays: number,
  futureDays: number,
): SeriesPoint[] {
  if (products.length === 0) return [];
  const ref = history[products[0].id] ?? [];
  const past = ref.slice(-pastDays).map((pt) => pt.date);
  const out: SeriesPoint[] = [];

  past.forEach((date, k) => {
    let actual = 0;
    let fitted = 0;
    for (const p of products) {
      const h = history[p.id];
      const point = h[h.length - past.length + k];
      const f = factorOf(p, metric);
      actual += (point?.units ?? 0) * f;
      const ins = insights[p.id];
      if (ins) fitted += predictForDate(ins.model, date) * f;
    }
    out.push({ date, label: formatDayShort(date), actual, fitted, expected: null, band: null, isToday: false });
  });

  const days = insights[products[0].id]?.forecast.length ?? 0;
  for (let d = 0; d < Math.min(days, futureDays + 1); d++) {
    let expected = 0;
    let varLow = 0;
    let varHigh = 0;
    let actual = 0;
    let date = '';
    for (const p of products) {
      const ins = insights[p.id];
      if (!ins) continue;
      const fp = ins.forecast[d];
      const f = factorOf(p, metric);
      date = fp.date;
      expected += fp.expected * f;
      varLow += ((fp.expected - fp.lower) * f) ** 2;
      varHigh += ((fp.upper - fp.expected) * f) ** 2;
      if (d === 0) actual += (todaySales[p.id] ?? 0) * f;
    }
    out.push({
      date,
      label: d === 0 ? 'Hoy' : formatDayShort(date),
      actual: d === 0 ? actual : null,
      fitted: null,
      expected,
      band: [Math.max(0, expected - Math.sqrt(varLow)), expected + Math.sqrt(varHigh)],
      isToday: d === 0,
    });
  }
  // Une visualmente la línea real con el pronóstico.
  const lastPast = out[past.length - 1];
  if (lastPast) lastPast.expected = lastPast.actual;
  return out;
}

/** Promedio por día de la semana de las últimas `weeks` semanas (lun … dom). */
export function weekdayProfile(products: Product[], history: SalesHistory, metric: Metric, weeks = 4): number[] {
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  if (products.length === 0) return buckets.map(() => 0);
  const ref = history[products[0].id] ?? [];
  const dates = ref.slice(-weeks * 7).map((p) => p.date);
  dates.forEach((date, k) => {
    let total = 0;
    for (const p of products) {
      const h = history[p.id];
      total += (h[h.length - dates.length + k]?.units ?? 0) * factorOf(p, metric);
    }
    buckets[weekdayIndex(date)].push(total);
  });
  return buckets.map((b) => mean(b));
}

export interface HourlyPoint {
  slot: number;
  actual: number;
  expected: number;
}

/** Ventas de hoy por franja horaria frente a la distribución esperada. */
export function hourlyToday(
  products: Product[],
  todayHourly: Record<string, number[]>,
  insights: Record<string, ProductInsight>,
  metric: Metric,
): HourlyPoint[] {
  return HOURLY_SHARE.map((share, slot) => {
    let actual = 0;
    let expected = 0;
    for (const p of products) {
      const f = factorOf(p, metric);
      actual += (todayHourly[p.id]?.[slot] ?? 0) * f;
      expected += (insights[p.id]?.expectedToday ?? 0) * share * f;
    }
    return { slot, actual, expected };
  });
}

export interface GroupSummary {
  count: number;
  revenueToday: number;
  expectedRevenueToday: number;
  unitsToday: number;
  stockValue: number;
  retailValue: number;
  riskCounts: Record<RiskLevel, number>;
  shelfCounts: Record<ShelfStatus, number>;
  outOfShelf: number;
  ordersNeeded: number;
  avgStockoutProbability: number;
  avgMape: number;
}

export function summarize(products: Product[], insights: Record<string, ProductInsight>): GroupSummary {
  const s: GroupSummary = {
    count: products.length,
    revenueToday: 0,
    expectedRevenueToday: 0,
    unitsToday: 0,
    stockValue: 0,
    retailValue: 0,
    riskCounts: { critico: 0, alto: 0, medio: 0, bajo: 0 },
    shelfCounts: { critico: 0, alerta: 0, optimo: 0 },
    outOfShelf: 0,
    ordersNeeded: 0,
    avgStockoutProbability: 0,
    avgMape: 0,
  };
  const mapes: number[] = [];
  const probs: number[] = [];
  for (const p of products) {
    const i = insights[p.id];
    if (!i) continue;
    s.revenueToday += i.soldToday * p.price;
    s.expectedRevenueToday += i.expectedToday * p.price;
    s.unitsToday += i.soldToday;
    s.stockValue += i.inventoryValue;
    s.retailValue += i.onHand * p.price;
    s.riskCounts[i.risk] += 1;
    s.shelfCounts[i.shelfStatus] += 1;
    if (p.stockGondola <= 0) s.outOfShelf += 1;
    if (i.orderInDays === 0) s.ordersNeeded += 1;
    probs.push(i.stockoutProbability);
    if (i.quality.mape > 0) mapes.push(i.quality.mape);
  }
  s.avgStockoutProbability = mean(probs);
  s.avgMape = mean(mapes);
  return s;
}

/** Ingresos diarios del histórico (S/) para un conjunto de productos. */
export function dailyRevenue(products: Product[], history: SalesHistory, days: number): { date: string; revenue: number; units: number }[] {
  if (products.length === 0) return [];
  const ref = history[products[0].id] ?? [];
  const dates = ref.slice(-days).map((p) => p.date);
  return dates.map((date, k) => {
    let revenue = 0;
    let units = 0;
    for (const p of products) {
      const h = history[p.id];
      const u = h[h.length - dates.length + k]?.units ?? 0;
      revenue += u * p.price;
      units += u;
    }
    return { date, revenue, units };
  });
}
