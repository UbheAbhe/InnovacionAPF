import { INITIAL_PRODUCTS } from '@/data/catalog';
import { generateSalesHistory } from '@/data/history';
import type {
  DayClose,
  EngineSettings,
  GlobalFilters,
  LostSales,
  Movement,
  Product,
  PurchaseOrder,
  SalesHistory,
  SimulatorState,
} from '@/domain/types';
import { hourSlot } from '@/engine/intraday';
import { addDays, OPERATING_HOURS, toDateKey } from '@/lib/dates';
import { uid } from '@/lib/random';

/** Estado global de la aplicación. Todo vive en memoria: no hay base de datos. */
export interface AppState {
  /** Reloj virtual de la tienda (ms). Avanza con el simulador. */
  now: number;
  /** Día en que arrancó la simulación. */
  originKey: string;
  products: Product[];
  /** Ventas diarias de días cerrados. */
  history: SalesHistory;
  todaySales: Record<string, number>;
  todayHourly: Record<string, number[]>;
  /** Demanda no atendida hoy (góndola vacía). */
  lostToday: Record<string, number>;
  /** Ventas perdidas acumuladas desde el inicio de la simulación. */
  lost: LostSales;
  movements: Movement[];
  orders: PurchaseOrder[];
  settings: EngineSettings;
  simulator: SimulatorState;
  filters: GlobalFilters;
  /** Alertas pospuestas: id → hasta qué instante (reloj virtual). */
  snoozed: Record<string, number>;
  dayCloses: DayClose[];
}

export const MAX_MOVEMENTS = 600;
export const DEFAULT_SETTINGS: EngineSettings = { serviceLevel: 0.95, coverageDays: 7, horizonDays: 14, lookbackDays: 56 };

export const zeroHourly = () => Array.from({ length: OPERATING_HOURS }, () => 0);

export function createInitialState(nowTs: number = Date.now()): AppState {
  const now = new Date(nowTs);
  const today = toDateKey(now);
  const { history, todaySales, todayHourly } = generateSalesHistory(now);
  const products = INITIAL_PRODUCTS.map((p) => ({ ...p }));
  const byId = new Map(products.map((p) => [p.id, p]));

  const orders: PurchaseOrder[] = [
    { id: uid('OC'), productId: 'aba-aceite', qty: 24, createdTs: nowTs - 86_400_000 * 2, etaDate: addDays(today, 1), status: 'pendiente' },
    { id: uid('OC'), productId: 'lim-papel', qty: 24, createdTs: nowTs - 86_400_000 * 2, etaDate: addDays(today, 2), status: 'pendiente' },
    { id: uid('OC'), productId: 'lac-yogurt', qty: 24, createdTs: nowTs - 86_400_000 * 5, etaDate: addDays(today, -3), status: 'recibido' },
  ];

  // Kardex inicial: movimientos del turno de hoy.
  const slotNow = Math.max(0, Math.min(OPERATING_HOURS - 1, hourSlot(now)));
  const at = (hoursAgo: number) => nowTs - hoursAgo * 3_600_000;
  const movements: Movement[] = [];
  const log = (m: Omit<Movement, 'id' | 'gondolaAfter' | 'almacenAfter'>) => {
    const p = byId.get(m.productId)!;
    movements.push({ ...m, id: uid('MV'), gondolaAfter: p.stockGondola, almacenAfter: p.stockAlmacen });
  };
  for (const p of products) {
    const sold = todaySales[p.id] ?? 0;
    if (sold > 0) {
      log({ ts: nowTs - 60_000, productId: p.id, type: 'VENTA', qty: sold, user: 'Caja 1', reason: `Ventas acumuladas del día (${slotNow + 1} franjas)`, amount: sold * p.price });
    }
  }
  log({ ts: at(3), productId: 'lac-leche', type: 'REPOSICION', qty: 24, user: 'Rosa (reposición)', reason: 'Reposición interna' });
  log({ ts: at(4), productId: 'beb-agua', type: 'ENTRADA', qty: 60, user: 'Centro de distribución', reason: 'Guía de remisión' });
  log({ ts: at(5), productId: 'lac-yogurt', type: 'MERMA', qty: 2, user: 'Luis (almacén)', reason: 'Merma por vencimiento' });
  log({ ts: at(6), productId: 'aba-arroz', type: 'REPOSICION', qty: 24, user: 'Rosa (reposición)', reason: 'Reposición interna' });
  movements.sort((a, b) => b.ts - a.ts);

  return {
    now: nowTs,
    originKey: today,
    products,
    history,
    todaySales,
    todayHourly,
    lostToday: Object.fromEntries(products.map((p) => [p.id, 0])),
    lost: { units: 0, amount: 0, byProduct: {} },
    movements,
    orders,
    settings: DEFAULT_SETTINGS,
    simulator: { running: false, speed: 1, autoRefill: false },
    filters: { query: '', categoryId: 'all', risk: 'all' },
    snoozed: {},
    dayCloses: [],
  };
}
