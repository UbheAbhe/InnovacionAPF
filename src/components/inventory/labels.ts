import type { Product } from '@/domain/types';
import type { ProductInsight } from '@/engine/inventory';
import { PROJECTION_DAYS } from '@/engine/inventory';
import { diffDays, formatDayShort } from '@/lib/dates';
import { number } from '@/lib/format';

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });

export function dayWord(dateKey: string, today: string): string {
  const n = diffDays(today, dateKey);
  if (n <= 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  return formatDayShort(dateKey);
}

/** "Hoy 19:40", "Mañana 10:15", "jue 15/10" */
export function stockoutWhen(i: ProductInsight, today: string): string {
  if (i.onHand <= 0) return 'Agotado';
  if (!i.stockoutDate || !i.stockoutAt) return `+${PROJECTION_DAYS} días`;
  const n = diffDays(today, i.stockoutDate);
  return n <= 1 ? `${dayWord(i.stockoutDate, today)} ${hhmm(i.stockoutAt)}` : formatDayShort(i.stockoutDate);
}

/** Tiempo para agotamiento en días de venta. */
export function stockoutSpan(i: ProductInsight): string {
  if (i.onHand <= 0) return '0 días';
  if (!Number.isFinite(i.daysToStockout)) return `> ${PROJECTION_DAYS} días`;
  if (i.daysToStockout < 1) return `${number(i.daysToStockout)} días`;
  return `${number(i.daysToStockout)} días`;
}

export function gondolaWhen(i: ProductInsight, today: string, p: Product): string {
  if (p.stockGondola <= 0) return 'Vacía';
  if (!i.gondolaEmptyAt) return 'Más de una semana';
  const d = new Date(i.gondolaEmptyAt);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${dayWord(key, today)} ${hhmm(i.gondolaEmptyAt)}`;
}

export function orderWhen(i: ProductInsight, today: string): string {
  if (!i.orderDate) return 'No requerido';
  return i.orderInDays === 0 ? 'Pedir hoy' : dayWord(i.orderDate, today);
}

export function packText(p: Product, packs: number): string {
  const word = p.packLabel.split(' ')[0].toLowerCase();
  const plural = packs === 1 ? word : word.endsWith('a') || word.endsWith('e') || word.endsWith('o') ? `${word}s` : `${word}es`;
  return `${packs} ${plural}`;
}
