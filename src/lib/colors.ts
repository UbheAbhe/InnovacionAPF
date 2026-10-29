import type { RiskLevel, ShelfStatus } from '@/domain/types';

/** Paleta categórica: el color sigue a la categoría en todos los gráficos. */
export const CATEGORY_COLORS = ['#E58A2E', '#3569B8', '#A88437', '#C2456F', '#17908B', '#7B62C4', '#7A5638'];
export const categoryColor = (slot: number) => CATEGORY_COLORS[slot % CATEGORY_COLORS.length];

export const RISK_ORDER: RiskLevel[] = ['critico', 'alto', 'medio', 'bajo'];
export const RISK_LABEL: Record<RiskLevel, string> = { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };
export const RISK_COLOR: Record<RiskLevel, string> = { critico: '#C62828', alto: '#E8890C', medio: '#F2B705', bajo: '#1E9B4B' };

export const SHELF_LABEL: Record<ShelfStatus, string> = { critico: 'Rojo · crítico', alerta: 'Ámbar · alerta', optimo: 'Verde · óptimo' };
export const SHELF_SHORT: Record<ShelfStatus, string> = { critico: 'Crítico', alerta: 'Alerta', optimo: 'Óptimo' };
export const SHELF_COLOR: Record<ShelfStatus, string> = { critico: '#C62828', alerta: '#F2B705', optimo: '#1E9B4B' };
export const SHELF_AS_RISK: Record<ShelfStatus, RiskLevel> = { critico: 'critico', alerta: 'medio', optimo: 'bajo' };

/** Gráficos: lo real en azul marino 3A, lo pronosticado en naranja 3A. */
export const CHART = {
  ink: '#18204A',
  muted: '#7A8193',
  grid: '#E6E8EE',
  actual: '#1F2C7A',
  forecast: '#E8461E',
  band: '#E8461E',
  fitted: '#9AA1B4',
  bar: '#1F2C7A',
  barSoft: '#C9CEDF',
  hover: '#F3F4F7',
};
