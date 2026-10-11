import { Bell, BrainCircuit, ChartLine, LayoutDashboard, Package, Receipt, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Inicio', icon: LayoutDashboard, description: 'Estado general de la tienda' },
  { to: '/productos', label: 'Catálogo y stock', short: 'Stock', icon: Package, description: 'Gestión interactiva del inventario' },
  { to: '/prediccion', label: 'Módulo predictivo', short: 'Predicción', icon: BrainCircuit, description: 'Agotamiento, reabastecimiento y pedidos' },
  { to: '/analisis', label: 'Análisis', short: 'Análisis', icon: ChartLine, description: 'Gráficos por categoría y producto' },
  { to: '/alertas', label: 'Alertas', short: 'Alertas', icon: Bell, description: 'Alertas dinámicas de stock' },
  { to: '/ventas', label: 'Ventas y kardex', short: 'Ventas', icon: Receipt, description: 'Métricas de ventas simuladas' },
];
