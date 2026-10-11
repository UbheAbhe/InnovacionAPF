/**
 * Modelo de dominio del Sistema de Inventario Inteligente — Tiendas 3A.
 * Todas las entidades viven en memoria (estado global de React); no hay base de datos.
 */

export type RiskLevel = 'critico' | 'alto' | 'medio' | 'bajo';
export type ShelfStatus = 'critico' | 'alerta' | 'optimo';
export type Unit = 'un' | 'kg';
export type AbcClass = 'A' | 'B' | 'C';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  /** Slot fijo de la paleta categórica (0-based). El color sigue a la entidad. */
  colorSlot: number;
  /** Días que tarda el centro de distribución en reabastecer esta categoría. */
  leadTimeDays: number;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  unit: Unit;
  price: number;
  cost: number;
  stockGondola: number;
  stockAlmacen: number;
  gondolaCapacity: number;
  /** Unidades por bulto de compra (caja, jaba, fardo). */
  packSize: number;
  packLabel: string;
  leadTimeDays: number;
  location: string;
  abc: AbcClass;
  emoji: string;
}

export type MovementType = 'VENTA' | 'ENTRADA' | 'REPOSICION' | 'MERMA' | 'AJUSTE';

export interface Movement {
  id: string;
  ts: number;
  productId: string;
  type: MovementType;
  /** Cantidad siempre positiva; el tipo define el sentido. En AJUSTE es la diferencia aplicada (puede ser negativa). */
  qty: number;
  reason?: string;
  user: string;
  amount?: number;
  gondolaAfter: number;
  almacenAfter: number;
}

export interface DailyPoint {
  /** Fecha local en formato YYYY-MM-DD */
  date: string;
  units: number;
}

export type SalesHistory = Record<string, DailyPoint[]>;

export type OrderStatus = 'pendiente' | 'recibido' | 'cancelado';

export interface PurchaseOrder {
  id: string;
  productId: string;
  qty: number;
  createdTs: number;
  etaDate: string;
  status: OrderStatus;
}

export interface EngineSettings {
  /** Nivel de servicio objetivo para el stock de seguridad. */
  serviceLevel: 0.9 | 0.95 | 0.99;
  /** Días de cobertura que debe cubrir un pedido luego de llegar. */
  coverageDays: number;
  /** Horizonte de pronóstico mostrado en los gráficos. */
  horizonDays: number;
  /** Días de historia usados para entrenar el modelo. */
  lookbackDays: number;
}

export interface LostSales {
  units: number;
  amount: number;
  byProduct: Record<string, number>;
}

export interface GlobalFilters {
  query: string;
  categoryId: string | 'all';
  risk: RiskLevel | 'all';
}

export interface SimulatorState {
  running: boolean;
  speed: 1 | 2 | 4;
  /** El personal repone la góndola automáticamente cuando baja del 30 % (simula seguir las alertas). */
  autoRefill: boolean;
}

/** Cierre diario registrado por el simulador (indicadores del informe). */
export interface DayClose {
  date: string;
  revenue: number;
  lostUnits: number;
  lostAmount: number;
  /** SKU con góndola en cero al cierre. */
  skusOut: number;
  skusTotal: number;
}
