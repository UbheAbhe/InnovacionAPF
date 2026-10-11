import { Minus, Plus, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AiTag } from '@/components/ui/Badges';
import { Modal } from '@/components/ui/Modal';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { useToast } from '@/components/ui/Toast';
import { addDays, formatDayShort, toDateKey } from '@/lib/dates';
import { money, qty } from '@/lib/format';
import { useStore } from '@/store/StoreProvider';

export interface OrderDraft {
  productId: string;
  qty: number;
}

/** Confirmación de pedidos al centro de distribución con cantidades editables por bulto. */
export function OrderDialog({ open, onClose, items }: { open: boolean; onClose: () => void; items: OrderDraft[] }) {
  const { state, dispatch, productById, categoryById, insights } = useStore();
  const toast = useToast();
  const [packs, setPacks] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setPacks(Object.fromEntries(items.map((it) => [it.productId, Math.max(1, Math.ceil(it.qty / (productById[it.productId]?.packSize ?? 1)))])));
  }, [open]);

  const today = toDateKey(new Date(state.now));
  const rows = items.map((it) => productById[it.productId]).filter(Boolean);
  const total = rows.reduce((s, p) => s + (packs[p.id] ?? 0) * p.packSize * p.cost, 0);

  const confirm = () => {
    const list = rows.map((p) => ({ productId: p.id, qty: (packs[p.id] ?? 0) * p.packSize })).filter((x) => x.qty > 0);
    if (!list.length) return;
    dispatch({ type: 'CREATE_ORDERS', items: list });
    toast(list.length === 1 ? `Pedido de ${productById[list[0].productId].name} enviado al centro de distribución.` : `${list.length} pedidos enviados al centro de distribución.`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="sm:max-w-xl"
      title={rows.length > 1 ? `Generar ${rows.length} pedidos sugeridos` : 'Generar pedido'}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <AiTag /> Cantidades sugeridas por el modelo; puedes ajustarlas antes de confirmar.
        </span>
      }
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted">
            Costo estimado: <strong className="num text-ink">{money(total)}</strong>
          </span>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={confirm} disabled={total <= 0}>
            <Truck size={16} aria-hidden /> Confirmar pedido
          </button>
        </>
      }
    >
      <ul className="divide-y divide-line">
        {rows.map((p) => {
          const n = packs[p.id] ?? 0;
          const i = insights[p.id];
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <ProductAvatar product={p} category={categoryById[p.categoryId]} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{p.name}</div>
                <div className="text-xs text-muted">
                  {p.packLabel} · llega {formatDayShort(addDays(today, p.leadTimeDays))} · stock {qty(i?.onHand ?? 0, p.unit)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-outline h-8 w-8 p-0" onClick={() => setPacks((s) => ({ ...s, [p.id]: Math.max(0, n - 1) }))} aria-label="Menos">
                  <Minus size={14} />
                </button>
                <span className="num w-10 text-center text-sm font-bold">{n}</span>
                <button className="btn-outline h-8 w-8 p-0" onClick={() => setPacks((s) => ({ ...s, [p.id]: n + 1 }))} aria-label="Más">
                  <Plus size={14} />
                </button>
              </div>
              <div className="num w-24 text-right text-sm">
                <div className="font-semibold">{qty(n * p.packSize, p.unit)}</div>
                <div className="text-xs text-muted">{money(n * p.packSize * p.cost)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
