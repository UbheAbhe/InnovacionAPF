import { createContext, type Dispatch, type ReactNode, useContext, useEffect, useMemo, useReducer } from 'react';
import { CATEGORIES } from '@/data/catalog';
import type { Category, Product } from '@/domain/types';
import { type Alert, buildAlerts } from '@/engine/alerts';
import { computeInsight, type ProductInsight } from '@/engine/inventory';
import { type Action, reducer } from './reducer';
import { type AppState, createInitialState } from './state';

export interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** Predicciones por producto, recalculadas ante cualquier cambio del estado. */
  insights: Record<string, ProductInsight>;
  alerts: Alert[];
  categories: Category[];
  categoryById: Record<string, Category>;
  productById: Record<string, Product>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Minutos de reloj virtual por segundo real a velocidad 1×. */
export const SIM_MINUTES_PER_SECOND = 5;

export function StoreProvider({ children, initialState }: { children: ReactNode; initialState?: AppState }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => init ?? createInitialState());
  const { running, speed } = state.simulator;

  // Simulador: avanza el reloj virtual y genera ventas mientras está activo.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => dispatch({ type: 'TICK', minutes: SIM_MINUTES_PER_SECOND * speed }), 1000);
    return () => window.clearInterval(id);
  }, [running, speed]);

  const { products, history, todaySales, orders, now, settings, snoozed } = state;

  const insights = useMemo(() => {
    const pendingBy = new Map<string, typeof orders>();
    for (const o of orders) {
      if (o.status !== 'pendiente') continue;
      pendingBy.set(o.productId, [...(pendingBy.get(o.productId) ?? []), o]);
    }
    const out: Record<string, ProductInsight> = {};
    for (const p of products) {
      out[p.id] = computeInsight({
        product: p,
        history: history[p.id] ?? [],
        soldToday: todaySales[p.id] ?? 0,
        pendingOrders: pendingBy.get(p.id) ?? [],
        now,
        settings,
      });
    }
    return out;
  }, [products, history, todaySales, orders, now, settings]);

  const alerts = useMemo(() => buildAlerts(products, insights, orders, now, snoozed), [products, insights, orders, now, snoozed]);

  const lookups = useMemo(
    () => ({
      categories: CATEGORIES,
      categoryById: Object.fromEntries(CATEGORIES.map((c) => [c.id, c])),
    }),
    [],
  );
  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const value = useMemo<StoreValue>(
    () => ({ state, dispatch, insights, alerts, productById, ...lookups }),
    [state, insights, alerts, productById, lookups],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}
