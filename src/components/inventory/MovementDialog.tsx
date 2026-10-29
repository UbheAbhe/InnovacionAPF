import { ArrowRightLeft, ClipboardList, PackageMinus, PackagePlus, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { useToast } from '@/components/ui/Toast';
import { number, qty as fmtQty } from '@/lib/format';
import { WASTE_REASONS, type WasteReason } from '@/store/reducer';
import { useStore } from '@/store/StoreProvider';

export type MovementKind = 'venta' | 'reposicion' | 'entrada' | 'merma' | 'ajuste';

const KINDS: { id: MovementKind; label: string; icon: typeof ShoppingCart }[] = [
  { id: 'venta', label: 'Venta', icon: ShoppingCart },
  { id: 'reposicion', label: 'Reponer góndola', icon: ArrowRightLeft },
  { id: 'entrada', label: 'Entrada', icon: PackagePlus },
  { id: 'merma', label: 'Merma', icon: PackageMinus },
  { id: 'ajuste', label: 'Ajuste', icon: ClipboardList },
];

/**
 * Registro ágil de movimientos (US1 / US5): producto, tipo y cantidad, con pulsadores rápidos
 * de unidades y de bultos completos para no tipear durante la hora pico.
 */
export function MovementDialog({
  open,
  onClose,
  productId: initialProduct,
  kind: initialKind = 'venta',
  initialQty,
}: {
  open: boolean;
  onClose: () => void;
  productId?: string;
  kind?: MovementKind;
  initialQty?: number;
}) {
  const { state, dispatch, insights, categoryById, productById } = useStore();
  const toast = useToast();
  const [productId, setProductId] = useState(initialProduct ?? state.products[0]?.id);
  const [kind, setKind] = useState<MovementKind>(initialKind);
  const [amount, setAmount] = useState<number>(initialQty ?? 0);
  const [reason, setReason] = useState<WasteReason>(WASTE_REASONS[0]);
  const [from, setFrom] = useState<'gondola' | 'almacen'>('gondola');
  const [adjG, setAdjG] = useState(0);
  const [adjA, setAdjA] = useState(0);

  const p = productById[productId ?? ''];

  // Reinicia el formulario cada vez que se abre.
  useEffect(() => {
    if (!open) return;
    const pid = initialProduct ?? state.products[0]?.id;
    setProductId(pid);
    setKind(initialKind);
    setAmount(initialQty ?? 0);
    const prod = productById[pid ?? ''];
    setAdjG(prod?.stockGondola ?? 0);
    setAdjA(prod?.stockAlmacen ?? 0);
  }, [open]);

  useEffect(() => {
    if (kind === 'ajuste' && p) {
      setAdjG(p.stockGondola);
      setAdjA(p.stockAlmacen);
    }
  }, [kind, productId]);

  const quick = useMemo(() => {
    if (!p) return [];
    const base = p.unit === 'kg' ? [0.5, 1, 2, 5] : [1, 6, 12, 24, 48];
    return base;
  }, [p]);

  if (!p) return null;
  const i = insights[p.id];
  const unit = p.unit === 'kg' ? 'kg' : 'un.';

  const preview = (() => {
    let g = p.stockGondola;
    let a = p.stockAlmacen;
    if (kind === 'venta') g = Math.max(0, g - amount);
    if (kind === 'reposicion') {
      const m = Math.min(amount, a);
      g += m;
      a -= m;
    }
    if (kind === 'entrada') a += amount;
    if (kind === 'merma') {
      if (from === 'gondola') g = Math.max(0, g - amount);
      else a = Math.max(0, a - amount);
    }
    if (kind === 'ajuste') {
      g = adjG;
      a = adjA;
    }
    return { g, a };
  })();

  const lostPreview = kind === 'venta' ? Math.max(0, amount - p.stockGondola) : 0;
  const invalid =
    kind === 'ajuste' ? adjG < 0 || adjA < 0 : amount <= 0 || (kind === 'reposicion' && p.stockAlmacen <= 0);

  const submit = () => {
    if (invalid) return;
    switch (kind) {
      case 'venta':
        dispatch({ type: 'SELL', productId: p.id, qty: amount });
        toast(
          lostPreview > 0
            ? `Venta registrada: ${number(amount - lostPreview)} ${unit}. ${number(lostPreview)} ${unit} no se atendieron (góndola vacía).`
            : `Venta de ${number(amount)} ${unit} de ${p.name} registrada.`,
          lostPreview > 0 ? 'warning' : 'success',
        );
        break;
      case 'reposicion':
        dispatch({ type: 'REFILL', productId: p.id, qty: amount });
        toast(`Se bajaron ${number(Math.min(amount, p.stockAlmacen))} ${unit} de ${p.name} a la góndola.`);
        break;
      case 'entrada':
        dispatch({ type: 'RECEIVE', productId: p.id, qty: amount });
        toast(`Ingreso de ${number(amount)} ${unit} de ${p.name} al almacén.`);
        break;
      case 'merma':
        dispatch({ type: 'WASTE', productId: p.id, qty: amount, reason, from });
        toast(`Merma registrada: ${number(amount)} ${unit} (${reason.toLowerCase()}).`, 'info');
        break;
      case 'ajuste':
        dispatch({ type: 'ADJUST', productId: p.id, gondola: adjG, almacen: adjA });
        toast(`Stock de ${p.name} ajustado por conteo físico.`, 'info');
        break;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar movimiento"
      subtitle="Se actualiza el kardex y se recalculan las predicciones al instante"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary flex-1 sm:flex-none" disabled={invalid} onClick={submit}>
            Registrar en kardex
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Producto</span>
          <select className="input" value={p.id} onChange={(e) => setProductId(e.target.value)}>
            {Object.values(categoryById).map((c) => (
              <optgroup key={c.id} label={c.name}>
                {state.products
                  .filter((x) => x.categoryId === c.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.emoji} {x.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3 rounded-md bg-page p-3">
          <ProductAvatar product={p} category={categoryById[p.categoryId]} size={40} />
          <div className="grid flex-1 grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-[11px] font-semibold text-muted">Góndola</div>
              <div className="num font-bold">
                {fmtQty(p.stockGondola, p.unit)} <span className="font-normal text-muted">/ {number(p.gondolaCapacity)}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted">Almacén</div>
              <div className="num font-bold">{fmtQty(p.stockAlmacen, p.unit)}</div>
            </div>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-semibold text-muted">Tipo de movimiento</span>
          <div className="grid grid-cols-5 gap-1.5">
            {KINDS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setKind(id)}
                aria-pressed={kind === id}
                className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-semibold leading-tight ${
                  kind === id ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:border-ink/40'
                }`}
              >
                <Icon size={17} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>

        {kind === 'ajuste' ? (
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold text-muted">Conteo en góndola ({unit})</span>
              <input className="input num" type="number" min={0} step={p.unit === 'kg' ? 0.1 : 1} value={adjG} onChange={(e) => setAdjG(Number(e.target.value))} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-muted">Conteo en almacén ({unit})</span>
              <input className="input num" type="number" min={0} step={p.unit === 'kg' ? 0.1 : 1} value={adjA} onChange={(e) => setAdjA(Number(e.target.value))} />
            </label>
          </div>
        ) : (
          <div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">Cantidad ({unit})</span>
              <input
                className="input num text-lg font-bold"
                type="number"
                inputMode="decimal"
                min={0}
                step={p.unit === 'kg' ? 0.1 : 1}
                value={amount || ''}
                placeholder="0"
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                data-autofocus
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quick.map((v) => (
                <button key={v} onClick={() => setAmount((a) => Math.round((a + v) * 10) / 10)} className="chip border-line bg-white text-ink hover:border-ink/40">
                  +{number(v)}
                </button>
              ))}
              <button onClick={() => setAmount((a) => a + p.packSize)} className="chip border-tag bg-tag-soft text-ink">
                + {p.packLabel}
              </button>
              {kind === 'reposicion' && i && i.shelfRefill > 0 && (
                <button onClick={() => setAmount(i.shelfRefill)} className="chip border-ink bg-ink text-white">
                  Sugerido: {number(i.shelfRefill)}
                </button>
              )}
              {amount > 0 && (
                <button onClick={() => setAmount(0)} className="chip border-transparent text-muted hover:text-ink">
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}

        {kind === 'merma' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-muted">Motivo</span>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value as WasteReason)}>
                {WASTE_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-muted">Desde</span>
              <select className="input" value={from} onChange={(e) => setFrom(e.target.value as 'gondola' | 'almacen')}>
                <option value="gondola">Góndola</option>
                <option value="almacen">Almacén</option>
              </select>
            </label>
          </div>
        )}

        <div className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">
          Después del registro: <strong className="num text-ink">Góndola {fmtQty(preview.g, p.unit)}</strong> ·{' '}
          <strong className="num text-ink">Almacén {fmtQty(preview.a, p.unit)}</strong>
          {lostPreview > 0 && <span className="mt-1 block text-riskText-critico">Solo hay {fmtQty(p.stockGondola, p.unit)} en góndola: el resto se registrará como venta perdida.</span>}
          {kind === 'reposicion' && p.stockAlmacen <= 0 && <span className="mt-1 block text-riskText-critico">No hay stock en almacén para reponer.</span>}
        </div>
      </div>
    </Modal>
  );
}
