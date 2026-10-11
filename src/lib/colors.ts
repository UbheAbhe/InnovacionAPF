import type { RiskLevel, ShelfStatus } from '@/domain/types';

/** Paleta categórica: el color sigue a la categoría en todos los gráficos. */
export const CATEGORY_COLORS = ['#F2862E', '#3B7DD8', '#B8892E', '#D2457A', '#14A3A0', '#8C6BD6', '#7C5A3C'];
export const categoryColor = (slot: number) => CATEGORY_COLORS[slot % CATEGORY_COLORS.length];

export const RISK_ORDER: RiskLevel[] = ['critico', 'alto', 'medio', 'bajo'];
export const RISK_LABEL: Record<RiskLevel, string> = { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };
export const RISK_COLOR: Record<RiskLevel, string> = { critico: '#D03B3B', alto: '#EC835A', medio: '#FAB219', bajo: '#0CA30C' };

export const SHELF_LABEL: Record<ShelfStatus, string> = { critico: 'Rojo · crítico', alerta: 'Ámbar · alerta', optimo: 'Verde · óptimo' };
export const SHELF_SHORT: Record<ShelfStatus, string> = { critico: 'Crítico', alerta: 'Alerta', optimo: 'Óptimo' };
export const SHELF_COLOR: Record<ShelfStatus, string> = { critico: '#D03B3B', alerta: '#FAB219', optimo: '#0CA30C' };
export const SHELF_AS_RISK: Record<ShelfStatus, RiskLevel> = { critico: 'critico', alerta: 'medio', optimo: 'bajo' };

export const CHART = {
  ink: '#20242C',
  muted: '#8A909C',
  grid: '#E9ECF0',
  actual: '#20242C',
  forecast: '#D9232A',
  band: '#D9232A',
  fitted: '#9AA1AD',
};
