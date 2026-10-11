import type { RiskLevel, ShelfStatus } from '@/domain/types';
import { RISK_LABEL, SHELF_AS_RISK, SHELF_SHORT } from '@/lib/colors';

const RISK_CLASSES: Record<RiskLevel, string> = {
  critico: 'bg-riskBg-critico text-riskText-critico border-risk-critico/30',
  alto: 'bg-riskBg-alto text-riskText-alto border-risk-alto/30',
  medio: 'bg-riskBg-medio text-riskText-medio border-risk-medio/40',
  bajo: 'bg-riskBg-bajo text-riskText-bajo border-risk-bajo/30',
};
const DOT: Record<RiskLevel, string> = {
  critico: 'bg-risk-critico',
  alto: 'bg-risk-alto',
  medio: 'bg-risk-medio',
  bajo: 'bg-risk-bajo',
};

export function RiskBadge({ risk, label, size = 'sm' }: { risk: RiskLevel; label?: string; size?: 'sm' | 'xs' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold ${RISK_CLASSES[risk]} ${
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[risk]}`} aria-hidden />
      {label ?? RISK_LABEL[risk]}
    </span>
  );
}

export function ShelfBadge({ status, size = 'sm' }: { status: ShelfStatus; size?: 'sm' | 'xs' }) {
  return <RiskBadge risk={SHELF_AS_RISK[status]} label={SHELF_SHORT[status]} size={size} />;
}

export function RiskDot({ risk }: { risk: RiskLevel }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[risk]}`} aria-hidden />;
}

export function AiTag() {
  return (
    <span
      title="Generado por el modelo predictivo. La decisión final es del administrador (Ley N.° 31814)."
      className="inline-flex items-center rounded-tag bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tag"
    >
      IA
    </span>
  );
}
