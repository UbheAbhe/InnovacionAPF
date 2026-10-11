import type { EngineSettings, GlobalFilters, Movement, MovementType, Product, SimulatorState } from '@/domain/types';
import { addDays, toDateKey } from '@/lib/dates';
import { uid } from '@/lib/random';
import { applySale, roundQty, simulateMinutes, simulateToNextDay } from './simulation';
import { type AppState, createInitialState, MAX_MOVEMENTS } from './state';

export type WasteReason = 'Merma por vencimiento' | 'Rotura en góndola' | 'Deterioro de empaque' | 'Pérdida / robo';
export const WASTE_REASONS: WasteReason[] = ['Merma por vencimiento', 'Rotura en góndola', 'Deterioro de empaque', 'Pérdida / robo'];

export type Action =
  | { type: 'TICK'; minutes: number }
  | { type: 'NEXT_DAY' }
  | { type: 'SELL'; productId: string; qty: number; user?: string }
  | { type: 'REFILL'; productId: string; qty: number; user?: string }
  | { type: 'RECEIVE'; productId: string; qty: number; user?: string; reason?: string }
  | { type: 'WASTE'; productId: string; qty: number; reason: WasteReason; from: 'gondola' | 'almacen'; user?: string }
  | { type: 'ADJUST'; productId: string; gondola: number; almacen: number; reason?: string; user?: string }
  | { type: 'UPDATE_PRODUCT'; productId: string; patch: Partial<Pick<Product, 'price' | 'cost' | 'gondolaCapacity' | 'leadTimeDays'>> }
  | { type: 'CREATE_ORDERS'; items: { productId: string; qty: number }[] }
  | { type: 'RECEIVE_ORDER'; orderId: string }
  | { type: 'CANCEL_ORDER'; orderId: string }
  | { type: 'SET_SETTINGS'; patch: Partial<EngineSettings> }
  | { type: 'SET_SIMULATOR'; patch: Partial<SimulatorState> }
  | { type: 'SET_FILTERS'; patch: Partial<GlobalFilters> }
  | { type: 'SNOOZE_ALERT'; alertId: string; minutes: number }
  | { type: 'RESET' };

const DEFAULT_USER = 'Administrador';

function patchProduct(state: AppState, id: string, fn: (p: Product) => Product): { products: Product[]; product?: Product } {
  let product: Product | undefined;
  const products = state.products.map((p) => {
    if (p.id !== id) return p;
    product = fn(p);
    return product;
  });
  return { products, product };
}

function movement(p: Product, type: MovementType, qty: number, ts: number, user: string, reason?: string, amount?: number): Movement {
  return { id: uid('MV'), ts, productId: p.id, type, qty, user, reason, amount, gondolaAfter: p.stockGondola, almacenAfter: p.stockAlmacen };
}

function pushMoves(state: AppState, moves: Movement[]): Movement[] {
  return [...moves, ...state.movements].slice(0, MAX_MOVEMENTS);
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'TICK':
      return simulateMinutes(state, action.minutes);

    case 'NEXT_DAY':
      return simulateToNextDay(state);

    case 'SELL': {
      const original = state.products.find((p) => p.id === action.productId);
      if (!original || action.qty <= 0) return state;
      const p = { ...original };
      const draft = {
        todaySales: { ...state.todaySales },
        todayHourly: { ...state.todayHourly },
        lostToday: { ...state.lostToday },
        lost: { ...state.lost, byProduct: { ...state.lost.byProduct } },
      };
      // Lo que no alcanza en góndola se registra como venta perdida (no como movimiento de kardex).
      const { sold } = applySale(draft, p, action.qty, state.now);
      const moves: Movement[] = [];
      if (sold > 0) moves.push(movement(p, 'VENTA', sold, state.now, action.user ?? 'Caja 1', 'Venta registrada manualmente', sold * p.price));
      return {
        ...state,
        ...draft,
        products: state.products.map((x) => (x.id === p.id ? p : x)),
        movements: pushMoves(state, moves),
      };
    }

    case 'REFILL': {
      const { products, product } = patchProduct(state, action.productId, (p) => {
        const qty = roundQty(Math.min(action.qty, p.stockAlmacen), p.unit);
        return { ...p, stockAlmacen: roundQty(p.stockAlmacen - qty, p.unit), stockGondola: roundQty(p.stockGondola + qty, p.unit) };
      });
      if (!product) return state;
      const moved = roundQty(product.stockGondola - (state.products.find((p) => p.id === product.id)?.stockGondola ?? 0), product.unit);
      if (moved <= 0) return state;
      return { ...state, products, movements: pushMoves(state, [movement(product, 'REPOSICION', moved, state.now, action.user ?? DEFAULT_USER, 'Reposición interna (almacén → góndola)')]) };
    }

    case 'RECEIVE': {
      if (action.qty <= 0) return state;
      const { products, product } = patchProduct(state, action.productId, (p) => ({ ...p, stockAlmacen: roundQty(p.stockAlmacen + action.qty, p.unit) }));
      if (!product) return state;
      return {
        ...state,
        products,
        movements: pushMoves(state, [movement(product, 'ENTRADA', action.qty, state.now, action.user ?? DEFAULT_USER, action.reason ?? 'Ingreso de mercadería')]),
      };
    }

    case 'WASTE': {
      let removed = 0;
      const { products, product } = patchProduct(state, action.productId, (p) => {
        const field = action.from === 'gondola' ? 'stockGondola' : 'stockAlmacen';
        removed = roundQty(Math.min(action.qty, p[field]), p.unit);
        return { ...p, [field]: roundQty(p[field] - removed, p.unit) };
      });
      if (!product || removed <= 0) return state;
      return {
        ...state,
        products,
        movements: pushMoves(state, [movement(product, 'MERMA', removed, state.now, action.user ?? DEFAULT_USER, `${action.reason} (${action.from === 'gondola' ? 'góndola' : 'almacén'})`)]),
      };
    }

    case 'ADJUST': {
      const before = state.products.find((p) => p.id === action.productId);
      if (!before) return state;
      const { products, product } = patchProduct(state, action.productId, (p) => ({
        ...p,
        stockGondola: roundQty(Math.max(0, action.gondola), p.unit),
        stockAlmacen: roundQty(Math.max(0, action.almacen), p.unit),
      }));
      if (!product) return state;
      const diff = roundQty(product.stockGondola + product.stockAlmacen - before.stockGondola - before.stockAlmacen, product.unit);
      return {
        ...state,
        products,
        movements: pushMoves(state, [movement(product, 'AJUSTE', diff, state.now, action.user ?? DEFAULT_USER, action.reason ?? 'Ajuste por conteo físico')]),
      };
    }

    case 'UPDATE_PRODUCT': {
      const { products } = patchProduct(state, action.productId, (p) => ({ ...p, ...action.patch }));
      return { ...state, products };
    }

    case 'CREATE_ORDERS': {
      const today = toDateKey(new Date(state.now));
      const newOrders = action.items
        .filter((it) => it.qty > 0)
        .map((it) => {
          const p = state.products.find((x) => x.id === it.productId);
          return {
            id: uid('OC'),
            productId: it.productId,
            qty: it.qty,
            createdTs: state.now,
            etaDate: addDays(today, p?.leadTimeDays ?? 2),
            status: 'pendiente' as const,
          };
        });
      if (newOrders.length === 0) return state;
      return { ...state, orders: [...newOrders, ...state.orders] };
    }

    case 'RECEIVE_ORDER': {
      const order = state.orders.find((o) => o.id === action.orderId);
      if (!order || order.status !== 'pendiente') return state;
      const { products, product } = patchProduct(state, order.productId, (p) => ({ ...p, stockAlmacen: roundQty(p.stockAlmacen + order.qty, p.unit) }));
      if (!product) return state;
      return {
        ...state,
        products,
        orders: state.orders.map((o) => (o.id === order.id ? { ...o, status: 'recibido' } : o)),
        movements: pushMoves(state, [movement(product, 'ENTRADA', order.qty, state.now, DEFAULT_USER, `Pedido ${order.id}`)]),
      };
    }

    case 'CANCEL_ORDER':
      return { ...state, orders: state.orders.map((o) => (o.id === action.orderId && o.status === 'pendiente' ? { ...o, status: 'cancelado' } : o)) };

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'SET_SIMULATOR':
      return { ...state, simulator: { ...state.simulator, ...action.patch } };

    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.patch } };

    case 'SNOOZE_ALERT':
      return { ...state, snoozed: { ...state.snoozed, [action.alertId]: state.now + action.minutes * 60_000 } };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}
