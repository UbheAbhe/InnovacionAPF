import type { DailyPoint } from '@/domain/types';
import { addDays, diffDays, weekdayIndex } from '@/lib/dates';
import { clamp, ewma, linearRegression, mae, mape, mean, rmse } from './stats';

export interface ForecastPoint {
  date: string;
  expected: number;
  lower: number;
  upper: number;
}

/**
 * Modelo de demanda: tendencia lineal (mínimos cuadrados) sobre la serie desestacionalizada,
 * multiplicada por un índice estacional por día de la semana.
 *
 *   demanda(t) = (a + b·t) × índice[díaSemana(t)]
 *
 * Es el equivalente en el navegador a un LinearRegression de scikit-learn con variables
 * de día de semana; se ejecuta 100 % en el frontend.
 */
export interface DemandModel {
  intercept: number;
  slope: number;
  weekdayIndex: number[];
  residualStd: number;
  r2: number;
  mean: number;
  level: number;
  /** Fecha correspondiente a t = 0 */
  originDate: string;
  /** Última fecha observada */
  lastDate: string;
  n: number;
}

export interface ModelQuality {
  /** Error porcentual absoluto medio del backtest, en %. */
  mape: number;
  mae: number;
  rmse: number;
  holdout: number;
}

const SEASONAL_SHRINK = 0.75;
const MAX_WEEKLY_TREND = 0.35;

export function computeWeekdayIndex(points: DailyPoint[]): number[] {
  const overall = mean(points.map((p) => p.units)) || 1;
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  points.forEach((p) => buckets[weekdayIndex(p.date)].push(p.units));
  const raw = buckets.map((b) => (b.length ? mean(b) / overall : 1));
  // "Shrinkage": acerca cada índice a 1 para no sobreajustar con pocas semanas.
  const shrunk = raw.map((r) => SEASONAL_SHRINK * r + (1 - SEASONAL_SHRINK));
  const norm = mean(shrunk) || 1;
  return shrunk.map((s) => s / norm);
}

export function fitDemandModel(points: DailyPoint[]): DemandModel {
  const idx = computeWeekdayIndex(points);
  const xs = points.map((_, i) => i);
  const deseason = points.map((p) => p.units / idx[weekdayIndex(p.date)]);
  const fit = linearRegression(xs, deseason);
  const m = mean(deseason);
  // Evita extrapolaciones agresivas: la tendencia no puede superar ±35 % semanal.
  const maxSlope = (MAX_WEEKLY_TREND * Math.max(m, 0.01)) / 7;
  const slope = clamp(fit.slope, -maxSlope, maxSlope);
  const intercept = m - slope * mean(xs);
  return {
    intercept,
    slope,
    weekdayIndex: idx,
    residualStd: fit.residualStd,
    r2: Math.max(0, fit.r2),
    mean: m,
    level: ewma(deseason.slice(-14), 0.25),
    originDate: points[0]?.date ?? '',
    lastDate: points[points.length - 1]?.date ?? '',
    n: points.length,
  };
}

/** Demanda esperada para una fecha cualquiera (pasada o futura). */
export function predictForDate(model: DemandModel, date: string): number {
  const t = diffDays(model.originDate, date);
  const trendLevel = model.intercept + model.slope * t;
  // Mezcla la tendencia lineal con el nivel suavizado reciente para mayor estabilidad.
  const ewmaLevel = model.level + model.slope * (t - (model.n - 1));
  const base = 0.65 * trendLevel + 0.35 * ewmaLevel;
  return Math.max(0, base * model.weekdayIndex[weekdayIndex(date)]);
}

/** Tendencia semanal relativa (0.08 = +8 % por semana). */
export function weeklyTrend(model: DemandModel): number {
  return model.mean > 0 ? (model.slope * 7) / model.mean : 0;
}

/**
 * Pronóstico diario desde `startDate` durante `days` días.
 * `adjust(d)` aplica un factor por día (por ejemplo, el nowcast con las ventas de hoy).
 * La banda usa z = 1.28 (intervalo del 80 %) y se ensancha con el horizonte.
 */
export function forecastRange(
  model: DemandModel,
  startDate: string,
  days: number,
  adjust: (dayOffset: number) => number = () => 1,
  z = 1.28,
): ForecastPoint[] {
  const out: ForecastPoint[] = [];
  const firstAhead = Math.max(1, diffDays(model.lastDate, startDate));
  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    const expected = predictForDate(model, date) * adjust(d);
    const ahead = firstAhead + d;
    const spread = z * model.residualStd * model.weekdayIndex[weekdayIndex(date)] * Math.sqrt(1 + (ahead - 1) / 14);
    out.push({ date, expected, lower: Math.max(0, expected - spread), upper: expected + spread });
  }
  return out;
}

/** Valida el modelo reservando los últimos `holdout` días (backtest fuera de muestra). */
export function backtest(points: DailyPoint[], holdout = 7): ModelQuality {
  if (points.length < holdout + 14) return { mape: 0, mae: 0, rmse: 0, holdout: 0 };
  const train = points.slice(0, -holdout);
  const test = points.slice(-holdout);
  const model = fitDemandModel(train);
  const preds = forecastRange(model, test[0].date, holdout).map((f) => f.expected);
  const actual = test.map((p) => p.units);
  return { mape: mape(actual, preds), mae: mae(actual, preds), rmse: rmse(actual, preds), holdout };
}

/* ---------- Caché: el modelo solo se reentrena cuando cambia el histórico (cierre de día) ---------- */

const modelCache = new WeakMap<DailyPoint[], Map<number, { model: DemandModel; quality: ModelQuality }>>();

export function getModel(history: DailyPoint[], lookbackDays: number): { model: DemandModel; quality: ModelQuality } {
  let byLookback = modelCache.get(history);
  if (!byLookback) {
    byLookback = new Map();
    modelCache.set(history, byLookback);
  }
  const cached = byLookback.get(lookbackDays);
  if (cached) return cached;
  const points = history.slice(-lookbackDays);
  const result = { model: fitDemandModel(points), quality: backtest(points) };
  byLookback.set(lookbackDays, result);
  return result;
}
