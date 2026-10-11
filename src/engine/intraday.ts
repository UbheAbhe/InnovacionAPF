import { OPERATING_HOURS, STORE_CLOSE_HOUR, STORE_OPEN_HOUR } from '@/lib/dates';

/**
 * Perfil de demanda intradía (franjas horarias) de la sucursal.
 * Cada posición corresponde a una hora de atención: índice 0 = 07:00–08:00 … índice 14 = 21:00–22:00.
 * Refleja lo observado en campo: pico de almuerzo y pico fuerte de 18:00 a 21:00 (salida del trabajo).
 */
const RAW_WEIGHTS = [3, 5, 5, 5, 6, 8, 8, 6, 5, 5, 7, 10, 11, 9, 6];
const TOTAL = RAW_WEIGHTS.reduce((s, w) => s + w, 0);

export const HOURLY_SHARE: number[] = RAW_WEIGHTS.map((w) => w / TOTAL);

/** Etiquetas "07h" … "21h" para los gráficos. */
export const HOUR_LABELS: string[] = HOURLY_SHARE.map((_, i) => `${String(STORE_OPEN_HOUR + i).padStart(2, '0')}h`);

/** Índice de franja (0…14) para una fecha; -1 antes de abrir, OPERATING_HOURS después de cerrar. */
export function hourSlot(d: Date): number {
  const h = d.getHours();
  if (h < STORE_OPEN_HOUR) return -1;
  if (h >= STORE_CLOSE_HOUR) return OPERATING_HOURS;
  return h - STORE_OPEN_HOUR;
}

/** Proporción de la demanda diaria que ya ocurrió hasta el instante `d` (0 a 1). */
export function cumulativeShare(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  if (h <= STORE_OPEN_HOUR) return 0;
  if (h >= STORE_CLOSE_HOUR) return 1;
  const offset = h - STORE_OPEN_HOUR;
  const slot = Math.floor(offset);
  let acc = 0;
  for (let i = 0; i < slot; i++) acc += HOURLY_SHARE[i];
  return acc + HOURLY_SHARE[slot] * (offset - slot);
}

/** Proporción de la demanda diaria entre dos instantes del mismo día. */
export function shareBetween(a: Date, b: Date): number {
  return Math.max(0, cumulativeShare(b) - cumulativeShare(a));
}

/**
 * Inversa de cumulativeShare: dada una proporción del día, devuelve la hora decimal (7.0 … 22.0)
 * en la que se alcanza. Sirve para estimar "a qué hora se agota".
 */
export function hourForShare(share: number): number {
  if (share <= 0) return STORE_OPEN_HOUR;
  if (share >= 1) return STORE_CLOSE_HOUR;
  let acc = 0;
  for (let i = 0; i < HOURLY_SHARE.length; i++) {
    if (acc + HOURLY_SHARE[i] >= share) {
      return STORE_OPEN_HOUR + i + (share - acc) / HOURLY_SHARE[i];
    }
    acc += HOURLY_SHARE[i];
  }
  return STORE_CLOSE_HOUR;
}

/** Hora de apertura / cierre del día de `d` en milisegundos. */
export function openingTs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), STORE_OPEN_HOUR).getTime();
}
export function closingTs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), STORE_CLOSE_HOUR).getTime();
}

export function isStoreOpen(d: Date): boolean {
  const s = hourSlot(d);
  return s >= 0 && s < OPERATING_HOURS;
}
