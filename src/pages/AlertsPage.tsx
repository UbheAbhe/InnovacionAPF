import { AlarmClock, ArrowRightLeft, BellOff, Copy, MessageCircle, PackageCheck, PackageX, ShoppingBasket, TrendingUp, TriangleAlert, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActions } from '@/components/inventory/ActionsProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { AiTag } from '@/components/ui/Badges';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { useToast } from '@/components/ui/Toast';
import { type Alert, ALERT_KIND_LABEL, type AlertKind, type AlertSeverity, whatsappMessage } from '@/engine/alerts';
import { number } from '@/lib/format';
import { matchesFilters } from '@/store/hooks';
import { useStore } from '@/store/StoreProvider';

const SEVERITY: Record<AlertSeverity, { label: string; bar: string; chip: string }> = {
  critico: { label: 'Crítico', bar: 'bg-risk-critico', chip: 'bg-riskBg-critico text-riskText-critico' },
  alto: { label: 'Alto', bar: 'bg-risk-alto', chip: 'bg-riskBg-alto text-riskText-alto' },
  medio: { label: 'Medio', bar: 'bg-risk-medio', chip: 'bg-riskBg-medio text-riskText-medio' },
  info: { label: 'Info', bar: 'bg-navy', chip: 'bg-[#E8EBF6] text-navy' },
};

const KIND_ICON: Record<AlertKind, typeof PackageX> = {
  'gondola-vacia': PackageX,
  'reponer-gondola': ArrowRightLeft,
  'quiebre-proyectado': TriangleAlert,
  'pedido-sugerido': Truck,
  'pedido-en-camino': PackageCheck,
  sobrestock: ShoppingBasket,
  'demanda-alza': TrendingUp,
};

export default function AlertsPage() {
  const { state, alerts, insights, productById, categoryById, dispatch } = useStore();
  const toast = useToast();
  const [sev, setSev] = useState<AlertSeverity | 'all'>('all');
  const [kind, setKind] = useState<AlertKind | 'all'>('all');
  const [preview, setPreview] = useState<Alert | null>(null);

  // Las alertas también respetan la búsqueda global y los filtros de categoría/riesgo.
  const scoped = useMemo(
    () =>
      alerts.filter((a) => {
        const p = productById[a.productId];
        return p && matchesFilters(p, insights[p.id], state.filters, categoryById[p.categoryId]?.name);
      }),
    [alerts, productById, insights, state.filters, categoryById],
  );
  const visible = scoped.filter((a) => (sev === 'all' || a.severity === sev) && (kind === 'all' || a.kind === kind));
  const counts = (['critico', 'alto', 'medio', 'info'] as AlertSeverity[]).map((s) => ({ s, n: scoped.filter((a) => a.severity === s).length }));
  const kinds = Array.from(new Set(scoped.map((a) => a.kind)));
  const snoozedCount = Object.values(state.snoozed).filter((t) => t > state.now).length;

  const copyDigest = async () => {
    const urgent = scoped.filter((a) => a.severity === 'critico' || a.severity === 'alto').slice(0, 10);
    const text = [`*Tiendas 3A — Sede Tantamayo*`, `Resumen de alertas (${urgent.length} urgentes)`, ...urgent.map((a) => `• ${a.title}`), '', '_Alertas generadas por el modelo predictivo._'].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Resumen copiado: pégalo en el grupo de WhatsApp del turno.');
    } catch {
      toast('No se pudo copiar al portapapeles.', 'warning');
    }
  };

  return (
    <>
      <PageHeader
        title="Alertas dinámicas"
        description="Se generan y priorizan automáticamente con cada venta, reposición o pedido. Cada alerta indica qué hacer, dónde y con qué urgencia."
        actions={
          <button className="btn-outline" onClick={copyDigest}>
            <MessageCircle size={16} aria-hidden /> Copiar resumen para WhatsApp
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {counts.map(({ s, n }) => (
          <button
            key={s}
            onClick={() => setSev(sev === s ? 'all' : s)}
            aria-pressed={sev === s}
            className={`panel flex items-center gap-3 p-3 text-left transition-shadow hover:shadow-pop ${sev === s ? 'ring-2 ring-ink' : ''}`}
          >
            <span className={`h-9 w-1.5 rounded-full ${SEVERITY[s].bar}`} aria-hidden />
            <span>
              <span className="figure block text-2xl">{n}</span>
              <span className="text-xs font-semibold text-muted">{SEVERITY[s].label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Tipo:</span>
        <button onClick={() => setKind('all')} aria-pressed={kind === 'all'} className={`chip ${kind === 'all' ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
          Todas
        </button>
        {kinds.map((k) => (
          <button key={k} onClick={() => setKind(kind === k ? 'all' : k)} aria-pressed={kind === k} className={`chip ${kind === k ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
            {ALERT_KIND_LABEL[k]}
          </button>
        ))}
        {snoozedCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
            <BellOff size={13} aria-hidden /> {snoozedCount} pospuestas
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="panel">
          <EmptyState icon={BellOff} title="No hay alertas con estos filtros">
            Cuando un producto entre en riesgo aparecerá aquí al instante.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {visible.map((a) => (
            <AlertCard key={a.id} alert={a} onPreview={() => setPreview(a)} onSnooze={() => {
              dispatch({ type: 'SNOOZE_ALERT', alertId: a.id, minutes: 15 });
              toast('Alerta pospuesta 15 minutos (reloj de la tienda).', 'info');
            }} />
          ))}
        </ul>
      )}

      <WhatsAppPreview alert={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function AlertCard({ alert: a, onPreview, onSnooze }: { alert: Alert; onPreview: () => void; onSnooze: () => void }) {
  const { productById, categoryById, dispatch, state } = useStore();
  const { openMovement, openOrder } = useActions();
  const toast = useToast();
  const p = productById[a.productId];
  const Icon = KIND_ICON[a.kind];
  const sev = SEVERITY[a.severity];
  const u = p.unit === 'kg' ? 'kg' : 'un.';

  const act = () => {
    if (!a.action) return;
    if (a.action.type === 'refill') openMovement({ productId: p.id, kind: 'reposicion', qty: a.action.qty });
    if (a.action.type === 'order') openOrder([{ productId: p.id, qty: a.action.qty }]);
    if (a.action.type === 'receive') {
      dispatch({ type: 'RECEIVE_ORDER', orderId: a.action.orderId });
      toast(`Pedido de ${p.name} recibido.`);
    }
  };
  const actionLabel =
    a.action?.type === 'refill' ? `Reponer ${number(a.action.qty)} ${u}` : a.action?.type === 'order' ? `Pedir ${number(a.action.qty)} ${u}` : a.action?.type === 'receive' ? 'Confirmar recepción' : null;
  const pendingOrder = state.orders.some((o) => o.productId === p.id && o.status === 'pendiente');

  return (
    <li className="panel relative flex gap-3 overflow-hidden p-4 pl-5">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${sev.bar}`} aria-hidden />
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${sev.chip}`}>
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${sev.chip}`}>{sev.label}</span>
          <span className="text-[11px] font-semibold text-muted">{ALERT_KIND_LABEL[a.kind]}</span>
          {a.predictive && <AiTag />}
        </div>
        <h3 className="mt-1 font-semibold leading-snug text-ink">{a.title}</h3>
        <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
        <Link to={`/analisis?p=${p.id}`} className="mt-2 inline-flex items-center gap-2 text-xs text-muted hover:text-ink">
          <ProductAvatar product={p} category={categoryById[p.categoryId]} size={22} />
          <span>
            Góndola {number(p.stockGondola)} · Almacén {number(p.stockAlmacen)} {u}
            {pendingOrder ? ' · pedido en camino' : ''}
          </span>
        </Link>
        <div className="mt-3 flex flex-wrap gap-2">
          {actionLabel && (
            <button className="btn-primary h-8 px-3 text-xs" onClick={act}>
              {actionLabel}
            </button>
          )}
          <button className="btn-outline h-8 px-3 text-xs" onClick={onSnooze}>
            <AlarmClock size={14} aria-hidden /> Posponer 15 min
          </button>
          <button className="btn-ghost h-8 px-3 text-xs" onClick={onPreview}>
            <MessageCircle size={14} aria-hidden /> Vista WhatsApp
          </button>
        </div>
      </div>
    </li>
  );
}

function WhatsAppPreview({ alert, onClose }: { alert: Alert | null; onClose: () => void }) {
  const { productById } = useStore();
  const toast = useToast();
  const p = alert ? productById[alert.productId] : undefined;
  const text = alert && p ? whatsappMessage(alert, p) : '';
  return (
    <Modal
      open={!!alert}
      onClose={onClose}
      title="Notificación preventiva (WhatsApp Business)"
      subtitle="Así llegaría el aviso al celular del encargado (US4). En el prototipo no se envía."
      footer={
        <>
          <button
            className="btn-outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                toast('Mensaje copiado.');
              } catch {
                toast('No se pudo copiar.', 'warning');
              }
            }}
          >
            <Copy size={15} aria-hidden /> Copiar
          </button>
          <a className="btn-primary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            <MessageCircle size={15} aria-hidden /> Abrir en WhatsApp
          </a>
        </>
      }
    >
      <div className="rounded-xl bg-[#E5DDD5] p-4">
        <div className="ml-auto max-w-[90%] whitespace-pre-line rounded-lg rounded-tr-none bg-[#DCF8C6] px-3 py-2 text-sm text-[#111] shadow-sm">
          {formatWhatsApp(text)}
          <div className="mt-1 text-right text-[10px] text-[#667781]">ahora ✓✓</div>
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#008069] shadow-sm">Bajar mercadería y reponer</span>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#008069] shadow-sm">Posponer 15 min</span>
        </div>
      </div>
    </Modal>
  );
}

/** Interpreta *negrita* y _cursiva_ como en WhatsApp. */
function formatWhatsApp(text: string) {
  return text.split('\n').map((line, i) => (
    <span key={i} className="block">
      {line.split(/(\*[^*]+\*|_[^_]+_)/g).map((part, j) =>
        part.startsWith('*') && part.endsWith('*') ? (
          <strong key={j}>{part.slice(1, -1)}</strong>
        ) : part.startsWith('_') && part.endsWith('_') ? (
          <em key={j} className="text-[#54656f]">
            {part.slice(1, -1)}
          </em>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </span>
  ));
}
