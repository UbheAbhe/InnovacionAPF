import { describe, expect, it } from 'vitest';
import type { DailyPoint, EngineSettings, Product } from '@/domain/types';
import { addDays } from '@/lib/dates';
import { backtest, fitDemandModel, forecastRange, predictForDate } from './forecast';
import { computeInsight, riskFrom, shelfStatusFor } from './inventory';
import { cumulativeShare, hourForShare, HOURLY_SHARE } from './intraday';
import { buildAlerts } from './alerts';
import { linearRegression, mae, mape, normalCdf, rmse } from './stats';

const SETTINGS: EngineSettings = { serviceLevel: 0.95, coverageDays: 7, horizonDays: 14, lookbackDays: 56 };

function series(n: number, f: (i: number) => number, start = '2026-08-03'): DailyPoint[] {
  return Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), units: f(i) }));
}

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  sku: 'X',
  barcode: '1',
  name: 'Producto prueba',
  categoryId: 'aba',
  unit: 'un',
  price: 5,
  cost: 3,
  stockGondola: 20,
  stockAlmacen: 40,
  gondolaCapacity: 40,
  packSize: 12,
  packLabel: 'Caja x12',
  leadTimeDays: 2,
  location: 'Pasillo 1',
  abc: 'A',
  emoji: '📦',
  ...over,
});

describe('estadística', () => {
  it('regresión lineal recupera pendiente e intercepto', () => {
    const fit = linearRegression([0, 1, 2, 3, 4], [2, 4, 6, 8, 10]);
    expect(fit.slope).toBeCloseTo(2);
    expect(fit.intercept).toBeCloseTo(2);
    expect(fit.r2).toBeCloseTo(1);
  });
  it('métricas de error', () => {
    expect(mae([10, 20], [12, 18])).toBe(2);
    expect(rmse([10, 20], [12, 18])).toBe(2);
    expect(mape([10, 20], [11, 18])).toBeCloseTo(10);
  });
  it('normal acumulada', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.645)).toBeCloseTo(0.95, 2);
    expect(normalCdf(-1.645)).toBeCloseTo(0.05, 2);
  });
});

describe('perfil intradía', () => {
  it('suma 1 y es monótono', () => {
    expect(HOURLY_SHARE.reduce((s, x) => s + x, 0)).toBeCloseTo(1);
    expect(cumulativeShare(new Date(2026, 9, 10, 6))).toBe(0);
    expect(cumulativeShare(new Date(2026, 9, 10, 23))).toBe(1);
    const a = cumulativeShare(new Date(2026, 9, 10, 12));
    const b = cumulativeShare(new Date(2026, 9, 10, 18, 30));
    expect(b).toBeGreaterThan(a);
  });
  it('hourForShare es la inversa de cumulativeShare', () => {
    const d = new Date(2026, 9, 10, 15, 30);
    expect(hourForShare(cumulativeShare(d))).toBeCloseTo(15.5, 3);
  });
});

describe('modelo de demanda', () => {
  it('detecta la tendencia creciente', () => {
    const pts = series(56, (i) => 20 + i * 0.3);
    const m = fitDemandModel(pts);
    expect(m.slope).toBeGreaterThan(0.2);
    const next = predictForDate(m, addDays(pts[55].date, 1));
    expect(next).toBeGreaterThan(30);
  });
  it('pronóstico con banda creciente y backtest razonable', () => {
    const pts = series(56, (i) => 30 + (i % 7 === 5 ? 10 : 0) + ((i * 7) % 5));
    const m = fitDemandModel(pts);
    const fc = forecastRange(m, addDays(pts[55].date, 1), 14);
    expect(fc).toHaveLength(14);
    expect(fc[13].upper - fc[13].lower).toBeGreaterThan(fc[0].upper - fc[0].lower);
    expect(backtest(pts).mape).toBeLessThan(25);
  });
});

describe('insights de inventario', () => {
  const history = series(56, () => 10, '2026-08-15'); // termina el 9/10
  const now = new Date(2026, 9, 10, 7, 0).getTime(); // 10/10 a la apertura

  it('calcula agotamiento, punto de reorden y pedido sugerido', () => {
    const i = computeInsight({ product: product({ stockGondola: 10, stockAlmacen: 8 }), history, soldToday: 0, pendingOrders: [], now, settings: SETTINGS });
    expect(i.forecastDaily).toBeCloseTo(10, 0);
    // 18 un. a 10 un./día → ~1.8 días
    expect(i.daysToStockout).toBeGreaterThan(1.5);
    expect(i.daysToStockout).toBeLessThan(2);
    // Lead time 2 días → ROP ≈ 20 + stock de seguridad → hay que pedir hoy
    expect(i.orderInDays).toBe(0);
    expect(i.suggestedOrderQty % 12).toBe(0);
    expect(i.suggestedOrderQty).toBeGreaterThanOrEqual(60);
    expect(i.restockDate).toBe('2026-10-12');
    expect(['alto', 'critico']).toContain(i.risk);
  });

  it('un producto con mucho stock tiene riesgo bajo y sobrestock', () => {
    const i = computeInsight({ product: product({ stockGondola: 40, stockAlmacen: 400 }), history, soldToday: 0, pendingOrders: [], now, settings: SETTINGS });
    expect(i.risk).toBe('bajo');
    // El próximo pedido queda lejos en el tiempo
    expect(i.orderInDays ?? 99).toBeGreaterThan(20);
    expect(i.overstock).toBe(true);
  });

  it('un pedido en camino extiende la cobertura', () => {
    const base = { product: product({ stockGondola: 10, stockAlmacen: 5 }), history, soldToday: 0, now, settings: SETTINGS };
    const without = computeInsight({ ...base, pendingOrders: [] });
    const withOrder = computeInsight({
      ...base,
      pendingOrders: [{ id: 'o1', productId: 'p1', qty: 60, createdTs: now, etaDate: '2026-10-11', status: 'pendiente' }],
    });
    expect(withOrder.daysToStockout).toBeGreaterThan(without.daysToStockout);
    expect(withOrder.restockSource).toBe('pedido');
  });

  it('stock cero es riesgo crítico', () => {
    const i = computeInsight({ product: product({ stockGondola: 0, stockAlmacen: 0 }), history, soldToday: 0, pendingOrders: [], now, settings: SETTINGS });
    expect(i.risk).toBe('critico');
    expect(i.daysToStockout).toBe(0);
    expect(i.stockoutProbability).toBe(1);
  });

  it('semáforo de góndola y niveles de riesgo', () => {
    expect(shelfStatusFor(0.2, 10)).toBe('critico');
    expect(shelfStatusFor(0.5, 10)).toBe('alerta');
    expect(shelfStatusFor(0.9, 10)).toBe('optimo');
    expect(shelfStatusFor(0.9, 1)).toBe('critico');
    expect(riskFrom(10, 0.01, null)).toBe('bajo');
    expect(riskFrom(10, 0.3, null)).toBe('alto');
  });

  it('genera alertas de góndola vacía con acción de reposición', () => {
    const p = product({ stockGondola: 0, stockAlmacen: 30 });
    const i = computeInsight({ product: p, history, soldToday: 0, pendingOrders: [], now, settings: SETTINGS });
    const alerts = buildAlerts([p], { p1: i }, [], now);
    const empty = alerts.find((a) => a.kind === 'gondola-vacia');
    expect(empty?.severity).toBe('critico');
    expect(empty?.action?.type).toBe('refill');
    // Posponer elimina la alerta
    const snoozed = buildAlerts([p], { p1: i }, [], now, { [empty!.id]: now + 60_000 });
    expect(snoozed.find((a) => a.kind === 'gondola-vacia')).toBeUndefined();
  });
});
