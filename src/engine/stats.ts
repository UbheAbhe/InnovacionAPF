/** Estadística básica usada por el motor predictivo. Funciones puras y testeables. */

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export interface LinearFit {
  intercept: number;
  slope: number;
  r2: number;
  residualStd: number;
}

/** Regresión lineal por mínimos cuadrados ordinarios: y = intercept + slope · x */
export function linearRegression(xs: number[], ys: number[]): LinearFit {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return { intercept: 0, slope: 0, r2: 0, residualStd: 0 };
  if (n === 1) return { intercept: ys[0], slope: 0, r2: 0, residualStd: 0 };
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return {
    intercept,
    slope,
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    residualStd: Math.sqrt(ssRes / Math.max(1, n - 2)),
  };
}

/** Media móvil exponencial; devuelve el último nivel suavizado. */
export function ewma(xs: number[], alpha = 0.3): number {
  if (xs.length === 0) return 0;
  return xs.reduce((level, x, i) => (i === 0 ? x : alpha * x + (1 - alpha) * level), xs[0]);
}

/** Error porcentual absoluto medio (MAPE). Ignora días con venta real cero. */
export function mape(actual: number[], predicted: number[]): number {
  const errs: number[] = [];
  for (let i = 0; i < Math.min(actual.length, predicted.length); i++) {
    if (actual[i] > 0) errs.push(Math.abs(actual[i] - predicted[i]) / actual[i]);
  }
  return errs.length ? mean(errs) * 100 : 0;
}

/** Error absoluto medio (MAE). */
export function mae(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(actual[i] - predicted[i]);
  return s / n;
}

/** Raíz del error cuadrático medio (RMSE). */
export function rmse(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += (actual[i] - predicted[i]) ** 2;
  return Math.sqrt(s / n);
}

export function sum(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}

/**
 * Función de distribución acumulada de la normal estándar Φ(x).
 * Aproximación de Abramowitz & Stegun 7.1.26 (error < 1.5e-7).
 */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/** Cuantil z de la normal estándar para niveles de servicio usuales. */
export function zForServiceLevel(level: number): number {
  if (level >= 0.99) return 2.33;
  if (level >= 0.95) return 1.65;
  if (level >= 0.9) return 1.28;
  return 1;
}
