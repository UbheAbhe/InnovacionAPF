import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'default' | 'critico' | 'alto' | 'medio' | 'bajo' | 'brand';

/** Marca de estado junto a la etiqueta (sigue el semáforo de riesgo). */
const MARK: Record<Tone, string> = {
  default: 'bg-line',
  critico: 'bg-risk-critico',
  alto: 'bg-risk-alto',
  medio: 'bg-risk-medio',
  bajo: 'bg-risk-bajo',
  brand: 'bg-brand',
};
/** Solo los estados críticos tiñen la cifra; el resto se mantiene en azul marino. */
const FIGURE: Record<Tone, string> = {
  default: 'text-ink',
  critico: 'text-riskText-critico',
  alto: 'text-ink',
  medio: 'text-ink',
  bajo: 'text-ink',
  brand: 'text-ink',
};

interface KpiProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
}

/**
 * Indicador clave con cifra estilo etiqueta de góndola.
 * Se usa dentro de <KpiStrip>, que los une en una sola franja con divisiones.
 */
export function Kpi({ label, value, sub, icon: Icon, tone = 'default', onClick }: KpiProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`flex min-w-0 flex-col gap-2.5 bg-white px-4 py-4 text-left ${onClick ? 'transition-colors hover:bg-page/70' : ''}`}
    >
      <div className="flex min-h-[33px] items-start gap-2">
        <span className={`mt-[5px] h-2 w-2 shrink-0 rounded-[2px] ${MARK[tone]}`} aria-hidden />
        <span className="line-clamp-2 flex-1 text-xs font-semibold leading-snug text-muted">{label}</span>
        {Icon && <Icon size={15} className="mt-px shrink-0 text-faint" strokeWidth={2} aria-hidden />}
      </div>
      <div className={`figure whitespace-nowrap text-[26px] sm:text-[28px] xl:text-[clamp(22px,1.9vw,30px)] ${FIGURE[tone]}`}>{value}</div>
      {sub && <div className="text-xs leading-snug text-muted">{sub}</div>}
    </Tag>
  );
}

/** Franja de indicadores: un solo bloque con divisiones finas, como una fila de etiquetas de precio. */
export function KpiStrip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-px overflow-hidden rounded-lg border border-line bg-line ${className}`}>{children}</div>;
}
