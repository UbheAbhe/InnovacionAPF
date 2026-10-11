import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { MovementDialog, type MovementKind } from './MovementDialog';
import { OrderDialog, type OrderDraft } from './OrderDialog';

interface Actions {
  openMovement: (opts?: { productId?: string; kind?: MovementKind; qty?: number }) => void;
  openOrder: (items: OrderDraft[]) => void;
}

const ActionsContext = createContext<Actions>({ openMovement: () => {}, openOrder: () => {} });

/** Expone los diálogos de registro de movimientos y de pedidos a cualquier pantalla. */
export function ActionsProvider({ children }: { children: ReactNode }) {
  const [movement, setMovement] = useState<{ open: boolean; productId?: string; kind?: MovementKind; qty?: number }>({ open: false });
  const [order, setOrder] = useState<{ open: boolean; items: OrderDraft[] }>({ open: false, items: [] });

  const openMovement = useCallback<Actions['openMovement']>((opts = {}) => setMovement({ open: true, ...opts }), []);
  const openOrder = useCallback((items: OrderDraft[]) => setOrder({ open: true, items }), []);
  const closeMovement = useCallback(() => setMovement((m) => ({ ...m, open: false })), []);
  const closeOrder = useCallback(() => setOrder((o) => ({ ...o, open: false })), []);
  const value = useMemo(() => ({ openMovement, openOrder }), [openMovement, openOrder]);

  return (
    <ActionsContext.Provider value={value}>
      {children}
      <MovementDialog open={movement.open} onClose={closeMovement} productId={movement.productId} kind={movement.kind} initialQty={movement.qty} />
      <OrderDialog open={order.open} onClose={closeOrder} items={order.items} />
    </ActionsContext.Provider>
  );
}

export const useActions = () => useContext(ActionsContext);
