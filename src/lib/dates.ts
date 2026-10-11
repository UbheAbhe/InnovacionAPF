/** Utilidades de fecha en hora local (la tienda opera en America/Lima). */

export const STORE_OPEN_HOUR = 7;
export const STORE_CLOSE_HOUR = 22;
export const OPERATING_HOURS = STORE_CLOSE_HOUR - STORE_OPEN_HOUR;

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

/** Lunes = 0 … Domingo = 6 */
export function weekdayIndex(key: string): number {
  return (fromDateKey(key).getDay() + 6) % 7;
}

/** Fracción de la jornada comercial ya transcurrida (0 a 1). */
export function dayFraction(now: Date): number {
  const h = now.getHours() + now.getMinutes() / 60;
  return Math.min(1, Math.max(0, (h - STORE_OPEN_HOUR) / OPERATING_HOURS));
}

const WEEKDAYS_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function formatDayShort(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS_SHORT[weekdayIndex(key)]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function formatDayMonth(key: string): string {
  const d = fromDateKey(key);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** "Hoy", "Mañana", "en 3 días (jue 15/10)" */
export function relativeDay(key: string, todayKey: string): string {
  const n = diffDays(todayKey, key);
  if (n <= 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  return `${formatDayShort(key)}`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
