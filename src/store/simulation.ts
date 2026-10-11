import { AVG_KG_BASKET, trueDailyDemand } from '@/data/demand';
import type { Movement, Product, Unit } from '@/domain/types';
import { closingTs, hourSlot, openingTs, shareBetween } from '@/engine/intraday';
import { addDays, OPERATING_HOURS, toDateKey } from '@/lib/dates';
import { createRng, poisson, uid } from '@/lib/random';
import { type AppState, MAX_MOVEMENTS, zeroHourly } from './state';

/**
 * Simulador de la operación de la tienda: genera las ventas de los clientes según la "demanda real",
 * cierra el día (pasa las ventas al histórico) y recibe los pedidos que llegan del centro de distribución.
 */

const rng = createRng(Date.now() & 0xffffffff);

export const roundQty = (v: number, unit: Unit) => (unit === 'kg' ? Math.round(v * 10) / 10 : Math.round(v));

/** Demanda de clientes en un tramo: Poisson en unidades; en granel, clientes × canasta aleatoria. */
function sampleDemand(lambda: number, unit: Unit): number {
  if (unit === 'un') return poisson(rng, lambda);
  const customers = poisson(rng, lambda / AVG_KG_BASKET);
  let kg = 0;
  for (let c = 0; c < customers; c++) kg += 0.4 + rng() * 0.8;
  return roundQty(kg, 'kg');
}

/** Registra una venta: descuenta góndola; lo que no hay en góndola se pierde. Muta los objetos recibidos. */
export function applySale(
  s: Pick<AppState, 'todaySales' | 'todayHourly' | 'lostToday' | 'lost'>,
  p: Product,
  qty: number,
  ts: number,
): { sold: number; lost: number } {
  const sold = roundQty(Math.min(qty, Math.max(0, p.stockGondola)), p.unit);
  const lost = roundQty(Math.max(0, qty - sold), p.unit);
  p.stockGondola = roundQty(p.stockGondola - sold, p.unit);
  const slot = Math.min(OPERATING_HOURS - 1, Math.max(0, hourSlot(new Date(ts))));
  s.todaySales[p.id] = roundQty((s.todaySales[p.id] ?? 0) + sold, p.unit);
  const hourly = (s.todayHourly[p.id] = [...(s.todayHourly[p.id] ?? zeroHourly())]);
  hourly[slot] = roundQty(hourly[slot] + sold, p.unit);
  if (lost > 0) {
    s.lostToday[p.id] = roundQty((s.lostToday[p.id] ?? 0) + lost, p.unit);
    s.lost.units += lost;
    s.lost.amount += lost * p.price;
    s.lost.byProduct[p.id] = roundQty((s.lost.byProduct[p.id] ?? 0) + lost, p.unit);
  }
  return { sold, lost };
}

function cloneForMutation(state: AppState): AppState {
  return {
    ...state,
    products: state.products.map((p) => ({ ...p })),
    todaySales: { ...state.todaySales },
    todayHourly: { ...state.todayHourly },
    lostToday: { ...state.lostToday },
    lost: { ...state.lost, byProduct: { ...state.lost.byProduct } },
    movements: [...state.movements],
  };
}

function simulateSegment(state: AppState, t1: number, t2: number): AppState {
  const share = shareBetween(new Date(t1), new Date(t2));
  if (share <= 0) return { ...state, now: t2 };
  const s = cloneForMutation(state);
  const dayKey = toDateKey(new Date(t1));
  const newMoves: Movement[] = [];

  for (const p of s.products) {
    const lambda = trueDailyDemand(p.id, dayKey, s.originKey) * share;
    const demand = sampleDemand(lambda, p.unit);
    if (demand <= 0) continue;
    const { sold } = applySale(s, p, demand, t2);
    if (sold > 0) {
      newMoves.push({
        id: uid('MV'),
        ts: t2,
        productId: p.id,
        type: 'VENTA',
        qty: sold,
        user: 'Caja (simulador)',
        amount: sold * p.price,
        gondolaAfter: p.stockGondola,
        almacenAfter: p.stockAlmacen,
      });
    }
  }

  // El personal sigue las alertas: repone la góndola cuando baja del 30 %.
  if (s.simulator.autoRefill) {
    for (const p of s.products) {
      if (p.stockAlmacen > 0 && p.stockGondola <= p.gondolaCapacity * 0.3) {
        const qty = roundQty(Math.min(p.stockAlmacen, p.gondolaCapacity - p.stockGondola), p.unit);
        if (qty <= 0) continue;
        p.stockAlmacen = roundQty(p.stockAlmacen - qty, p.unit);
        p.stockGondola = roundQty(p.stockGondola + qty, p.unit);
        newMoves.push({
          id: uid('MV'),
          ts: t2,
          productId: p.id,
          type: 'REPOSICION',
          qty,
          user: 'Reposición automática',
          reason: 'Alerta de góndola < 30 %',
          gondolaAfter: p.stockGondola,
          almacenAfter: p.stockAlmacen,
        });
      }
    }
  }

  s.movements = [...newMoves.reverse(), ...s.movements].slice(0, MAX_MOVEMENTS);
  s.now = t2;
  return s;
}

/** Cierra el día: guarda ventas en el histórico, registra indicadores y abre el día siguiente. */
export function rollover(state: AppState): AppState {
  const todayKey = toDateKey(new Date(state.now));
  const nextKey = addDays(todayKey, 1);
  const history: AppState['history'] = {};
  let revenue = 0;
  let lostUnits = 0;
  let lostAmount = 0;
  let skusOut = 0;
  for (const p of state.products) {
    const sold = state.todaySales[p.id] ?? 0;
    history[p.id] = [...(state.history[p.id] ?? []), { date: todayKey, units: roundQty(sold, p.unit) }];
    revenue += sold * p.price;
    lostUnits += state.lostToday[p.id] ?? 0;
    lostAmount += (state.lostToday[p.id] ?? 0) * p.price;
    if (p.stockGondola <= 0) skusOut += 1;
  }

  const [y, m, d] = nextKey.split('-').map(Number);
  const nextOpen = openingTs(new Date(y, m - 1, d));

  // Llegada de pedidos del centro de distribución al abrir.
  const products = state.products.map((p) => ({ ...p }));
  const byId = new Map(products.map((p) => [p.id, p]));
  const arrivals: Movement[] = [];
  const orders = state.orders.map((o) => {
    if (o.status !== 'pendiente' || o.etaDate > nextKey) return o;
    const p = byId.get(o.productId);
    if (!p) return o;
    p.stockAlmacen = roundQty(p.stockAlmacen + o.qty, p.unit);
    arrivals.push({
      id: uid('MV'),
      ts: nextOpen,
      productId: p.id,
      type: 'ENTRADA',
      qty: o.qty,
      user: 'Centro de distribución',
      reason: `Pedido ${o.id}`,
      gondolaAfter: p.stockGondola,
      almacenAfter: p.stockAlmacen,
    });
    return { ...o, status: 'recibido' as const };
  });

  const zeros = Object.fromEntries(state.products.map((p) => [p.id, 0]));
  return {
    ...state,
    now: nextOpen,
    products,
    orders,
    history,
    todaySales: { ...zeros },
    todayHourly: Object.fromEntries(state.products.map((p) => [p.id, zeroHourly()])),
    lostToday: { ...zeros },
    movements: [...arrivals, ...state.movements].slice(0, MAX_MOVEMENTS),
    dayCloses: [
      ...state.dayCloses,
      { date: todayKey, revenue, lostUnits, lostAmount, skusOut, skusTotal: state.products.length },
    ],
  };
}

/** Avanza el reloj virtual `minutes` minutos de atención (la noche se salta). */
export function simulateMinutes(state: AppState, minutes: number): AppState {
  let s = state;
  let remaining = minutes * 60_000;
  let guard = 0;
  while (remaining > 0 && guard++ < 200) {
    const d = new Date(s.now);
    const open = openingTs(d);
    const close = closingTs(d);
    if (s.now < open) {
      s = { ...s, now: open };
      continue;
    }
    if (s.now >= close) {
      s = rollover(s);
      continue;
    }
    const end = Math.min(s.now + remaining, close);
    remaining -= end - s.now;
    s = simulateSegment(s, s.now, end);
  }
  return s;
}

/** Simula el resto del día y abre el siguiente. */
export function simulateToNextDay(state: AppState): AppState {
  const startKey = toDateKey(new Date(state.now));
  let s = state;
  let guard = 0;
  while (toDateKey(new Date(s.now)) === startKey && guard++ < 120) s = simulateMinutes(s, 20);
  return s;
}
