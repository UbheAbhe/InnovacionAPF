import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'default' | 'critico' | 'alto' | 'medio' | 'bajo' | 'brand';

const TONE: Record<Tone, string> = {
  default: 'bg-page text-ink',
  critico: 'bg-riskBg-critico text-riskText-critico',
  alto: 'bg-riskBg-alto text-riskText-alto',
  medio: 'bg-riskBg-medio text-riskText-medio',
  bajo: 'bg-riskBg-bajo text-riskText-bajo',
  brand: 'bg-tag-soft text-ink',
};

interface KpiProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
}

/** Indicador clave con cifra estilo etiqueta de góndola. */
export function Kpi({ label, value, sub, icon: Icon, tone = 'default', onClick }: KpiProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`panel flex min-w-0 flex-col gap-2 p-4 text-left ${onClick ? 'transition-shadow hover:shadow-pop' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-muted">{label}</span>
        {Icon && (
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONE[tone]}`}>
            <Icon size={15} strokeWidth={2.2} aria-hidden />
          </span>
        )}
      </div>
      <div className="figure truncate text-[28px] text-ink sm:text-[32px]">{value}</div>
      {sub && <div className="text-xs leading-snug text-muted">{sub}</div>}
    </Tag>
  );
}
