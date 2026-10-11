import type { DailyPoint, EngineSettings, Product, PurchaseOrder, RiskLevel, ShelfStatus } from '@/domain/types';
import { addDays, diffDays, toDateKey, STORE_CLOSE_HOUR, STORE_OPEN_HOUR, OPERATING_HOURS } from '@/lib/dates';
import { type DemandModel, type ForecastPoint, type ModelQuality, forecastRange, getModel, predictForDate, weeklyTrend } from './forecast';
import { cumulativeShare, hourForShare } from './intraday';
import { clamp, mean, normalCdf, sum, zForServiceLevel } from './stats';

/** Horizonte máximo que recorre la proyección de stock para buscar el agotamiento. */
export const PROJECTION_DAYS = 60;
/** Más de estos días de inventario se considera sobrestock (lenta rotación). */
export const OVERSTOCK_DAYS = 30;

export interface StockProjectionPoint {
  date: string;
  /** Stock total (góndola + almacén) al cierre del día. */
  stock: number;
  demand: number;
  arrivals: number;
}

export interface ProductInsight {
  productId: string;
  model: DemandModel;
  quality: ModelQuality;

  // Consumo
  avgDaily7: number;
  avgDaily28: number;
  /** Consumo diario pronosticado (promedio de los próximos 7 días). */
  forecastDaily: number;
  /** Tendencia lineal semanal (0.08 = +8 %/semana). */
  trendWeekly: number;
  soldToday: number;
  /** Venta total esperada hoy (vendido + lo que falta vender). */
  expectedToday: number;
  remainingToday: number;
  /** Factor de corrección intradía aplicado al pronóstico (1 = sin corrección). */
  nowcast: number;
  /** Consumo promedio por hora de atención. */
  hourlyRate: number;

  // Stock
  onHand: number;
  onOrder: number;
  inventoryPosition: number;
  inventoryValue: number;
  /** Días de cobertura simples: stock ÷ consumo promedio de 7 días. */
  coverageDays: number;
  daysOfInventory: number;
  overstock: boolean;

  // Agotamiento
  /** Días de venta hasta agotar el stock según la proyección (Infinity si no se agota en 60 días). */
  daysToStockout: number;
  stockoutAt: number | null;
  stockoutDate: string | null;

  // Góndola
  gondolaPct: number;
  shelfStatus: ShelfStatus;
  /** Horas de atención hasta vaciar la góndola. */
  gondolaHoursLeft: number;
  gondolaEmptyAt: number | null;
  /** Unidades sugeridas para bajar del almacén a la góndola. */
  shelfRefill: number;

  // Reabastecimiento
  safetyStock: number;
  leadTimeDemand: number;
  reorderPoint: number;
  /** Fecha sugerida para emitir el pedido (null si no hace falta en el horizonte). */
  orderDate: string | null;
  /** Días hasta la fecha sugerida de pedido (0 = hoy). */
  orderInDays: number | null;
  suggestedOrderQty: number;
  suggestedPacks: number;
  /** Fecha estimada de reabastecimiento (pedido en camino o pedido sugerido + tiempo de entrega). */
  restockDate: string | null;
  restockSource: 'pedido' | 'sugerido' | null;
  /** Se espera quiebre antes de que llegue la mercadería. */
  gapBeforeRestock: boolean;

  // Riesgo
  stockoutProbability: number;
  riskScore: number;
  risk: RiskLevel;

  forecast: ForecastPoint[];
  projection: StockProjectionPoint[];
  summary: string;
}

export interface InsightInput {
  product: Product;
  /** Días cerrados (sin hoy). */
  history: DailyPoint[];
  soldToday: number;
  pendingOrders: PurchaseOrder[];
  now: number;
  settings: EngineSettings;
}

const SHELF_RED = 0.3;
const SHELF_AMBER = 0.6;

export function shelfStatusFor(pct: number, hoursLeft: number): ShelfStatus {
  if (pct <= SHELF_RED || hoursLeft < 2) return 'critico';
  if (pct <= SHELF_AMBER || hoursLeft < 4) return 'alerta';
  return 'optimo';
}

export function riskFrom(onHand: number, p: number, orderInDays: number | null): RiskLevel {
  if (onHand <= 0 || p >= 0.5) return 'critico';
  if (p >= 0.2 || orderInDays === 0) return 'alto';
  if (p >= 0.05 || (orderInDays !== null && orderInDays <= 2)) return 'medio';
  return 'bajo';
}

export function computeInsight({ product, history, soldToday, pendingOrders, now, settings }: InsightInput): ProductInsight {
  const nowD = new Date(now);
  const today = toDateKey(nowD);
  const { model, quality } = getModel(history, settings.lookbackDays);
  const cum = cumulativeShare(nowD);

  // 1. Nowcast: compara lo vendido hoy con lo esperado a esta hora y corrige el pronóstico.
  const baseToday = predictForDate(model, today);
  const expectedSoFar = baseToday * cum;
  let nowcast = 1;
  if (expectedSoFar >= 0.5 && cum > 0.05) {
    // Pseudo-conteo de 3 unidades: evita sobrerreaccionar en productos de baja rotación.
    const ratio = (soldToday + 3) / (expectedSoFar + 3);
    const weight = Math.min(1, cum * 1.5);
    nowcast = clamp(1 + weight * 0.6 * (ratio - 1), 0.5, 1.8);
    // Si la góndola está vacía, la venta baja es demanda censurada: no se corrige a la baja.
    if (product.stockGondola <= 0 && nowcast < 1) nowcast = 1;
  }
  const adjust = (d: number) => 1 + (nowcast - 1) * Math.pow(0.5, d);
  const fc = forecastRange(model, today, PROJECTION_DAYS, adjust);
  const todayTotal = baseToday * nowcast;
  const remainingToday = todayTotal * (1 - cum);
  const expectedToday = soldToday + remainingToday;
  const shift = expectedToday - fc[0].expected;
  fc[0] = { ...fc[0], expected: expectedToday, lower: Math.max(soldToday, fc[0].lower + shift), upper: fc[0].upper + shift };

  // Demanda por "día de venta": d = 0 es lo que resta de hoy.
  const D = fc.map((f, d) => (d === 0 ? remainingToday : f.expected));

  // 2. Consumo histórico
  const units = history.map((p) => p.units);
  const avgDaily7 = mean(units.slice(-7));
  const avgDaily28 = mean(units.slice(-28));
  const forecastDaily = mean(D.slice(1, 8));
  const hourlyRate = forecastDaily / OPERATING_HOURS;

  // 3. Stock y pedidos
  const onHand = product.stockGondola + product.stockAlmacen;
  const onOrder = sum(pendingOrders.map((o) => o.qty));
  const inventoryPosition = onHand + onOrder;
  const arrivalsByOffset = new Map<number, number>();
  for (const o of pendingOrders) {
    const off = Math.max(0, diffDays(today, o.etaDate));
    arrivalsByOffset.set(off, (arrivalsByOffset.get(off) ?? 0) + o.qty);
  }
  const nextArrivalOffset = pendingOrders.length ? Math.min(...arrivalsByOffset.keys()) : null;

  // 4. Proyección de stock día a día hasta encontrar el agotamiento
  let stock = onHand;
  let daysToStockout = Infinity;
  let stockoutAt: number | null = null;
  let stockoutDate: string | null = null;
  const projection: StockProjectionPoint[] = [];
  for (let d = 0; d < PROJECTION_DAYS; d++) {
    const date = fc[d].date;
    const arrivals = arrivalsByOffset.get(d) ?? 0;
    stock += arrivals;
    const demand = D[d];
    if (stockoutDate === null && (stock <= 0 || (demand > 0 && stock - demand <= 0))) {
      const frac = demand > 0 ? clamp(stock / demand, 0, 1) : 0;
      daysToStockout = d === 0 ? frac * (1 - cum) : 1 - cum + (d - 1) + frac;
      const share = d === 0 ? cum + frac * (1 - cum) : frac;
      stockoutDate = date;
      stockoutAt = tsAt(date, hourForShare(share));
    }
    stock = Math.max(0, stock - demand);
    projection.push({ date, stock, demand, arrivals });
  }

  // 5. Góndola: horas de atención hasta vaciarse (demanda repartida por franja horaria)
  const gondolaPct = product.gondolaCapacity > 0 ? product.stockGondola / product.gondolaCapacity : 0;
  const { hoursLeft: gondolaHoursLeft, emptyAt: gondolaEmptyAt } = gondolaDepletion(
    product.stockGondola,
    nowD,
    cum,
    fc.map((f, d) => (d === 0 ? todayTotal : f.expected)),
    today,
  );
  const shelfStatus = shelfStatusFor(gondolaPct, gondolaHoursLeft);
  const shelfRefill =
    shelfStatus === 'optimo' ? 0 : roundQty(Math.min(product.stockAlmacen, product.gondolaCapacity - product.stockGondola), product.unit);

  // 6. Stock de seguridad, punto de reorden y pedido sugerido
  const z = zForServiceLevel(settings.serviceLevel);
  const L = Math.max(1, product.leadTimeDays);
  const sigma = Math.max(model.residualStd, 0.05 * forecastDaily);
  const safetyStock = z * sigma * Math.sqrt(L);
  const demandWindow = (from: number, len: number) => sum(D.slice(from, from + len));
  const cumDemandBefore = (d: number) => demandWindow(0, d);
  // Revisión periódica diaria: si no se pide hoy, el siguiente pedido llegaría un día más tarde,
  // por eso el punto de reorden cubre el tiempo de entrega + 1 día de revisión.
  const leadTimeDemand = demandWindow(0, L + 1);
  const reorderPoint = leadTimeDemand + safetyStock;

  let orderInDays: number | null = null;
  for (let d = 0; d + L + 1 < PROJECTION_DAYS; d++) {
    const ipD = inventoryPosition - cumDemandBefore(d);
    if (ipD <= demandWindow(d, L + 1) + safetyStock) {
      orderInDays = d;
      break;
    }
  }
  const orderDate = orderInDays === null ? null : addDays(today, orderInDays);
  let suggestedOrderQty = 0;
  let suggestedPacks = 0;
  if (orderInDays !== null) {
    const ipAt = inventoryPosition - cumDemandBefore(orderInDays);
    const target = demandWindow(orderInDays, L + 1 + settings.coverageDays) + safetyStock;
    const raw = Math.max(0, target - ipAt);
    suggestedPacks = Math.max(1, Math.ceil(raw / product.packSize));
    suggestedOrderQty = suggestedPacks * product.packSize;
  }

  let restockDate: string | null = null;
  let restockSource: ProductInsight['restockSource'] = null;
  if (nextArrivalOffset !== null) {
    restockDate = addDays(today, nextArrivalOffset);
    restockSource = 'pedido';
  } else if (orderDate) {
    restockDate = addDays(orderDate, L);
    restockSource = 'sugerido';
  }

  // 7. Probabilidad de quiebre antes de la próxima reposición posible (aprox. normal)
  const horizonOffset = nextArrivalOffset !== null ? Math.min(nextArrivalOffset, L) : L;
  const muH = demandWindow(0, Math.max(1, horizonOffset));
  const horizonDays = Math.max(0.25, 1 - cum + Math.max(0, horizonOffset - 1));
  const sigmaH = Math.max(sigma * Math.sqrt(horizonDays), 0.1 * muH + 0.5);
  const stockoutProbability = onHand <= 0 ? 1 : clamp(1 - normalCdf((onHand - muH) / sigmaH), 0, 1);
  const risk = riskFrom(onHand, stockoutProbability, orderInDays);
  const riskScore = Math.round(stockoutProbability * 100);

  const restockOffset = restockDate ? diffDays(today, restockDate) : Infinity;
  const stockoutOffset = stockoutDate ? diffDays(today, stockoutDate) : Infinity;
  const gapBeforeRestock = stockoutDate !== null && stockoutOffset < restockOffset;

  const coverageDays = avgDaily7 > 0 ? onHand / avgDaily7 : Infinity;
  const daysOfInventory = avgDaily28 > 0 ? onHand / avgDaily28 : Infinity;
  const overstock = daysOfInventory > OVERSTOCK_DAYS;

  const insight: ProductInsight = {
    productId: product.id,
    model,
    quality,
    avgDaily7,
    avgDaily28,
    forecastDaily,
    trendWeekly: weeklyTrend(model),
    soldToday,
    expectedToday,
    remainingToday,
    nowcast,
    hourlyRate,
    onHand,
    onOrder,
    inventoryPosition,
    inventoryValue: onHand * product.cost,
    coverageDays,
    daysOfInventory,
    overstock,
    daysToStockout,
    stockoutAt,
    stockoutDate,
    gondolaPct,
    shelfStatus,
    gondolaHoursLeft,
    gondolaEmptyAt,
    shelfRefill,
    safetyStock,
    leadTimeDemand,
    reorderPoint,
    orderDate,
    orderInDays,
    suggestedOrderQty,
    suggestedPacks,
    restockDate,
    restockSource,
    gapBeforeRestock,
    stockoutProbability,
    riskScore,
    risk,
    forecast: fc,
    projection,
    summary: '',
  };
  insight.summary = buildSummary(product, insight, today);
  return insight;
}

/* ------------------------------------------------------------------ */

function tsAt(dateKey: string, hourDecimal: number): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const h = Math.floor(hourDecimal);
  const min = Math.round((hourDecimal - h) * 60);
  return new Date(y, m - 1, d, h, min).getTime();
}

function roundQty(v: number, unit: Product['unit']): number {
  return unit === 'kg' ? Math.max(0, Math.round(v * 10) / 10) : Math.max(0, Math.floor(v));
}

/**
 * Horas de atención hasta que la góndola se vacía, recorriendo la demanda por franja horaria.
 * `dayTotals[0]` es la demanda total de hoy; los siguientes, la de cada día futuro.
 */
export function gondolaDepletion(
  gondola: number,
  now: Date,
  cumNow: number,
  dayTotals: number[],
  todayKey: string,
): { hoursLeft: number; emptyAt: number | null } {
  if (gondola <= 0) return { hoursLeft: 0, emptyAt: now.getTime() };
  const hourNow = clamp(now.getHours() + now.getMinutes() / 60, STORE_OPEN_HOUR, STORE_CLOSE_HOUR);
  let left = gondola;
  let hours = 0;
  for (let d = 0; d < Math.min(dayTotals.length, 7); d++) {
    const total = dayTotals[d];
    const startShare = d === 0 ? cumNow : 0;
    const startHour = d === 0 ? hourNow : STORE_OPEN_HOUR;
    const dayDemand = total * (1 - startShare);
    if (total > 0 && left <= dayDemand) {
      const share = startShare + left / total;
      const hour = hourForShare(share);
      hours += hour - startHour;
      return { hoursLeft: hours, emptyAt: tsAt(addDays(todayKey, d), hour) };
    }
    left -= dayDemand;
    hours += STORE_CLOSE_HOUR - startHour;
  }
  return { hoursLeft: Infinity, emptyAt: null };
}

const fmt = (v: number) => (v >= 10 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());

function buildSummary(p: Product, i: ProductInsight, today: string): string {
  const u = p.unit === 'kg' ? 'kg' : 'un.';
  const parts: string[] = [];
  const trend =
    Math.abs(i.trendWeekly) < 0.02
      ? 'estable'
      : `${i.trendWeekly > 0 ? 'al alza' : 'a la baja'} (${i.trendWeekly > 0 ? '+' : ''}${Math.round(i.trendWeekly * 100)} %/semana)`;
  parts.push(`Se venden ~${fmt(i.forecastDaily)} ${u} al día, con demanda ${trend}.`);
  if (i.onHand <= 0) {
    parts.push('No queda stock en tienda.');
  } else if (Number.isFinite(i.daysToStockout)) {
    const when = i.stockoutDate === today ? 'hoy' : i.stockoutDate === addDays(today, 1) ? 'mañana' : `en ${fmt(i.daysToStockout)} días`;
    parts.push(`Con ${fmt(i.onHand)} ${u} en tienda, se agotaría ${when}.`);
  } else {
    parts.push(`Con ${fmt(i.onHand)} ${u} en tienda, el stock cubre más de ${PROJECTION_DAYS} días.`);
  }
  if (i.orderInDays === 0) {
    parts.push(`Conviene pedir hoy ${i.suggestedPacks} × ${p.packLabel} (${fmt(i.suggestedOrderQty)} ${u}).`);
  } else if (i.orderDate) {
    parts.push(`El próximo pedido debería hacerse en ${i.orderInDays} día(s).`);
  }
  if (i.gapBeforeRestock && i.onHand > 0) parts.push('Riesgo: se agotaría antes de que llegue la mercadería.');
  return parts.join(' ');
}
