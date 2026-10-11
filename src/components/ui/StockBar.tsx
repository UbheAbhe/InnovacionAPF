import type { ShelfStatus } from '@/domain/types';
import { SHELF_COLOR } from '@/lib/colors';

/** Barra de llenado de góndola con las marcas del semáforo (30 % y 60 %). */
export function StockBar({ pct, status, className = '' }: { pct: number; status: ShelfStatus; className?: string }) {
  const w = Math.max(0, Math.min(1, pct)) * 100;
  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-line ${className}`} role="meter" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${w}%`, background: SHELF_COLOR[status] }} />
      <span className="absolute inset-y-0 left-[30%] w-px bg-white/90" aria-hidden />
      <span className="absolute inset-y-0 left-[60%] w-px bg-white/90" aria-hidden />
    </div>
  );
}
