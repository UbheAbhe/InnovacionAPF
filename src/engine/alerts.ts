import type { Product, PurchaseOrder } from '@/domain/types';
import { addDays, diffDays, formatDayShort, toDateKey } from '@/lib/dates';
import type { ProductInsight } from './inventory';

export type AlertSeverity = 'critico' | 'alto' | 'medio' | 'info';
export type AlertKind =
  | 'gondola-vacia'
  | 'reponer-gondola'
  | 'quiebre-proyectado'
  | 'pedido-sugerido'
  | 'pedido-en-camino'
  | 'sobrestock'
  | 'demanda-alza';

export type AlertAction =
  | { type: 'refill'; qty: number }
  | { type: 'order'; qty: number }
  | { type: 'receive'; orderId: string };

export interface Alert {
  /** Estable por producto y tipo, para poder posponerla. */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  productId: string;
  title: string;
  detail: string;
  /** Prioridad para ordenar (menor = más urgente). */
  rank: number;
  action?: AlertAction;
  /** true si la alerta proviene del modelo predictivo (transparencia exigida por la Ley N.° 31814). */
  predictive: boolean;
}

export const SEVERITY_ORDER: Record<AlertSeverity, number> = { critico: 0, alto: 1, medio: 2, info: 3 };

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  'gondola-vacia': 'Góndola vacía',
  'reponer-gondola': 'Reponer góndola',
  'quiebre-proyectado': 'Quiebre proyectado',
  'pedido-sugerido': 'Pedido sugerido',
  'pedido-en-camino': 'Pedido en camino',
  sobrestock: 'Sobrestock',
  'demanda-alza': 'Demanda al alza',
};

const timeOf = (ts: number) => new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
const q = (v: number, p: Product) => `${p.unit === 'kg' ? Math.round(v * 10) / 10 : Math.round(v)} ${p.unit === 'kg' ? 'kg' : 'un.'}`;

function whenLabel(dateKey: string, today: string): string {
  const n = diffDays(today, dateKey);
  if (n <= 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `el ${formatDayShort(dateKey)}`;
}

/** Genera las alertas dinámicas a partir de las predicciones vigentes. Se recalcula en cada cambio de estado. */
export function buildAlerts(
  products: Product[],
  insights: Record<string, ProductInsight>,
  orders: PurchaseOrder[],
  now: number,
  snoozed: Record<string, number> = {},
): Alert[] {
  const today = toDateKey(new Date(now));
  const alerts: Alert[] = [];
  const push = (a: Alert) => {
    if ((snoozed[a.id] ?? 0) > now) return;
    alerts.push(a);
  };

  for (const p of products) {
    const i = insights[p.id];
    if (!i) continue;

    // Góndola
    if (p.stockGondola <= 0) {
      push({
        id: `gondola-vacia:${p.id}`,
        kind: 'gondola-vacia',
        severity: 'critico',
        productId: p.id,
        title: `${p.name}: góndola vacía`,
        detail:
          p.stockAlmacen > 0
            ? `Se están perdiendo ventas. Hay ${q(p.stockAlmacen, p)} en almacén: bajar a ${p.location}.`
            : 'Tampoco hay stock en almacén. Se están perdiendo ventas.',
        rank: 0,
        action: p.stockAlmacen > 0 ? { type: 'refill', qty: i.shelfRefill || p.stockAlmacen } : i.suggestedOrderQty > 0 ? { type: 'order', qty: i.suggestedOrderQty } : undefined,
        predictive: false,
      });
    } else if (i.shelfStatus !== 'optimo' && p.stockAlmacen > 0) {
      const sev = i.shelfStatus === 'critico' ? 'alto' : 'medio';
      const emptyText =
        i.gondolaEmptyAt && toDateKey(new Date(i.gondolaEmptyAt)) === today
          ? `se vaciaría hoy cerca de las ${timeOf(i.gondolaEmptyAt)}`
          : `queda al ${Math.round(i.gondolaPct * 100)} % de su capacidad`;
      push({
        id: `reponer-gondola:${p.id}`,
        kind: 'reponer-gondola',
        severity: sev,
        productId: p.id,
        title: `Reponer ${p.name}`,
        detail: `La góndola ${emptyText}. Bajar ${q(i.shelfRefill, p)} del almacén a ${p.location}.`,
        rank: 1 + Math.min(i.gondolaHoursLeft, 48) / 100,
        action: i.shelfRefill > 0 ? { type: 'refill', qty: i.shelfRefill } : undefined,
        predictive: true,
      });
    }

    // Stock total y abastecimiento
    const pending = orders.filter((o) => o.productId === p.id && o.status === 'pendiente');
    if (p.stockGondola + p.stockAlmacen > 0 && (i.risk === 'critico' || i.risk === 'alto') && i.stockoutDate) {
      const restock = i.restockDate ? whenLabel(i.restockDate, today) : 'sin fecha';
      push({
        id: `quiebre-proyectado:${p.id}`,
        kind: 'quiebre-proyectado',
        severity: i.risk,
        productId: p.id,
        title: `${p.name} se agotaría ${whenLabel(i.stockoutDate, today)}`,
        detail: `Probabilidad de quiebre ${i.riskScore} %. ${
          i.restockSource === 'pedido' ? `El pedido en camino llega ${restock}.` : `Si se pide hoy, llegaría ${whenLabel(addDays(today, p.leadTimeDays), today)}.`
        }${i.suggestedOrderQty > 0 && i.orderInDays === 0 ? ` Pedido sugerido: ${q(i.suggestedOrderQty, p)}` : ''}`,
        rank: 2 + Math.min(i.daysToStockout, 30) / 100,
        action: i.suggestedOrderQty > 0 && i.orderInDays === 0 ? { type: 'order', qty: i.suggestedOrderQty } : undefined,
        predictive: true,
      });
    } else if (i.orderInDays === 0 && i.suggestedOrderQty > 0) {
      push({
        id: `pedido-sugerido:${p.id}`,
        kind: 'pedido-sugerido',
        severity: 'medio',
        productId: p.id,
        title: `Punto de reorden alcanzado: ${p.name}`,
        detail: `El stock disponible (${q(i.inventoryPosition, p)}) ya está en el punto de reorden (${q(i.reorderPoint, p)}). Pedir ${i.suggestedPacks} × ${p.packLabel}.`,
        rank: 3,
        action: { type: 'order', qty: i.suggestedOrderQty },
        predictive: true,
      });
    }

    for (const o of pending) {
      const n = diffDays(today, o.etaDate);
      if (n <= 1) {
        push({
          id: `pedido-en-camino:${o.id}`,
          kind: 'pedido-en-camino',
          severity: 'info',
          productId: p.id,
          title: `Pedido de ${p.name} llega ${whenLabel(o.etaDate, today)}`,
          detail: `${q(o.qty, p)} desde el centro de distribución. Confirmar la recepción en almacén al llegar.`,
          rank: 5,
          action: n <= 0 ? { type: 'receive', orderId: o.id } : undefined,
          predictive: false,
        });
      }
    }

    if (i.overstock && Number.isFinite(i.daysOfInventory)) {
      push({
        id: `sobrestock:${p.id}`,
        kind: 'sobrestock',
        severity: 'info',
        productId: p.id,
        title: `Lenta rotación: ${p.name}`,
        detail: `Hay stock para ${Math.round(i.daysOfInventory)} días (${q(i.onHand, p)}). Evaluar promoción o reubicación para liberar capital.`,
        rank: 6,
        predictive: true,
      });
    }

    if (i.trendWeekly >= 0.07 && i.risk !== 'bajo') {
      push({
        id: `demanda-alza:${p.id}`,
        kind: 'demanda-alza',
        severity: 'info',
        productId: p.id,
        title: `Demanda al alza: ${p.name}`,
        detail: `Las ventas crecen ${Math.round(i.trendWeekly * 100)} % por semana. Revisar el stock mínimo de la góndola.`,
        rank: 7,
        predictive: true,
      });
    }
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.rank - b.rank);
}

/** Texto del aviso preventivo con el formato del mensaje de WhatsApp Business (US4). */
export function whatsappMessage(alert: Alert, product: Product, storeName = 'Tiendas 3A — Sede Tantamayo'): string {
  const icon = alert.severity === 'critico' ? '🔴' : alert.severity === 'alto' ? '🟠' : alert.severity === 'medio' ? '🟡' : '🔵';
  const lines = [
    `${icon} *${storeName}*`,
    `*${alert.title}*`,
    alert.detail,
    `📍 ${product.location}`,
  ];
  if (alert.predictive) lines.push('_Alerta generada por el modelo predictivo. La decisión final es del administrador._');
  return lines.join('\n');
}
