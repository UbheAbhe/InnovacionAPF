import type { AbcClass, Category, Product, Unit } from '@/domain/types';

/**
 * Catálogo simulado de la sucursal Av. Tantamayo 1032 (San Martín de Porres).
 * Los tiempos de reabastecimiento dependen del centro de distribución por categoría.
 */
export const CATEGORIES: Category[] = [
  { id: 'fv', name: 'Frutas y verduras', emoji: '🍊', colorSlot: 0, leadTimeDays: 1 },
  { id: 'lac', name: 'Lácteos y huevos', emoji: '🥛', colorSlot: 1, leadTimeDays: 2 },
  { id: 'aba', name: 'Abarrotes', emoji: '🍚', colorSlot: 2, leadTimeDays: 3 },
  { id: 'beb', name: 'Bebidas', emoji: '🥤', colorSlot: 3, leadTimeDays: 2 },
  { id: 'lim', name: 'Limpieza del hogar', emoji: '🧺', colorSlot: 4, leadTimeDays: 4 },
  { id: 'cui', name: 'Cuidado personal', emoji: '🧼', colorSlot: 5, leadTimeDays: 5 },
  { id: 'pan', name: 'Panadería y snacks', emoji: '🍞', colorSlot: 6, leadTimeDays: 1 },
];

/** Parámetros del generador de demanda (no forman parte del producto visible). */
export interface DemandProfile {
  /** Unidades promedio vendidas por día. */
  base: number;
  /** Crecimiento semanal de la demanda (0.08 = +8 % por semana). */
  weeklyTrend: number;
  /** Factores por día de semana (lun … dom). */
  weekday?: number[];
}

interface Seed {
  id: string;
  name: string;
  cat: string;
  unit?: Unit;
  price: number;
  cost: number;
  g: number;
  a: number;
  cap: number;
  pack: number;
  packLabel: string;
  loc: string;
  abc: AbcClass;
  emoji: string;
  demand: DemandProfile;
}

const WEEKEND_STRONG = [0.82, 0.8, 0.86, 0.95, 1.2, 1.45, 1.25];
const MARKET_DAYS = [0.95, 0.9, 0.92, 0.95, 1.05, 1.3, 1.2];

const SEEDS: Seed[] = [
  // Frutas y verduras (venta a granel por kg)
  { id: 'fv-mandarina', name: 'Mandarina', cat: 'fv', unit: 'kg', price: 4.5, cost: 3.1, g: 6, a: 10, cap: 40, pack: 10, packLabel: 'Jaba x10 kg', loc: 'Pasillo 1, isla de frutas', abc: 'A', emoji: '🍊', demand: { base: 18, weeklyTrend: 0.08, weekday: MARKET_DAYS } },
  { id: 'fv-platano', name: 'Plátano de seda', cat: 'fv', unit: 'kg', price: 3.9, cost: 2.6, g: 30, a: 60, cap: 40, pack: 10, packLabel: 'Jaba x10 kg', loc: 'Pasillo 1, isla de frutas', abc: 'A', emoji: '🍌', demand: { base: 22, weeklyTrend: 0.01, weekday: MARKET_DAYS } },
  { id: 'fv-manzana', name: 'Manzana delicia', cat: 'fv', unit: 'kg', price: 5.9, cost: 4.0, g: 25, a: 40, cap: 35, pack: 10, packLabel: 'Jaba x10 kg', loc: 'Pasillo 1, isla de frutas', abc: 'B', emoji: '🍎', demand: { base: 12, weeklyTrend: 0, weekday: MARKET_DAYS } },
  { id: 'fv-palta', name: 'Palta fuerte', cat: 'fv', unit: 'kg', price: 8.9, cost: 6.2, g: 4, a: 12, cap: 25, pack: 10, packLabel: 'Jaba x10 kg', loc: 'Pasillo 1, isla de frutas', abc: 'B', emoji: '🥑', demand: { base: 9, weeklyTrend: -0.04, weekday: MARKET_DAYS } },
  { id: 'fv-limon', name: 'Limón sutil', cat: 'fv', unit: 'kg', price: 6.5, cost: 4.3, g: 15, a: 10, cap: 25, pack: 10, packLabel: 'Saco x10 kg', loc: 'Pasillo 1, verduras', abc: 'B', emoji: '🍋', demand: { base: 9, weeklyTrend: 0.12, weekday: MARKET_DAYS } },
  { id: 'fv-papa', name: 'Papa amarilla', cat: 'fv', unit: 'kg', price: 3.6, cost: 2.4, g: 50, a: 100, cap: 60, pack: 25, packLabel: 'Saco x25 kg', loc: 'Pasillo 1, verduras', abc: 'A', emoji: '🥔', demand: { base: 25, weeklyTrend: 0, weekday: MARKET_DAYS } },
  { id: 'fv-tomate', name: 'Tomate italiano', cat: 'fv', unit: 'kg', price: 4.2, cost: 2.8, g: 18, a: 20, cap: 30, pack: 10, packLabel: 'Jaba x10 kg', loc: 'Pasillo 1, verduras', abc: 'B', emoji: '🍅', demand: { base: 14, weeklyTrend: 0.02, weekday: MARKET_DAYS } },

  // Lácteos y huevos
  { id: 'lac-leche', name: 'Leche Gloria azul 400 g', cat: 'lac', price: 4.2, cost: 3.3, g: 12, a: 24, cap: 72, pack: 24, packLabel: 'Caja x24', loc: 'Pasillo 2, góndola A', abc: 'A', emoji: '🥛', demand: { base: 40, weeklyTrend: 0.03 } },
  { id: 'lac-yogurt', name: 'Yogurt Gloria fresa 1 L', cat: 'lac', price: 6.9, cost: 5.1, g: 20, a: 36, cap: 24, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 2, refrigerado', abc: 'B', emoji: '🍓', demand: { base: 14, weeklyTrend: 0.02 } },
  { id: 'lac-queso', name: 'Queso fresco Bonlé 500 g', cat: 'lac', price: 13.9, cost: 10.2, g: 10, a: 18, cap: 12, pack: 6, packLabel: 'Caja x6', loc: 'Pasillo 2, refrigerado', abc: 'B', emoji: '🧀', demand: { base: 6, weeklyTrend: 0 } },
  { id: 'lac-mantequilla', name: 'Mantequilla Laive 200 g', cat: 'lac', price: 8.5, cost: 6.4, g: 14, a: 60, cap: 18, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 2, refrigerado', abc: 'C', emoji: '🧈', demand: { base: 5, weeklyTrend: -0.02 } },
  { id: 'lac-huevos', name: 'Huevos rosados x15', cat: 'lac', price: 9.9, cost: 7.6, g: 6, a: 20, cap: 20, pack: 10, packLabel: 'Bandeja x10', loc: 'Pasillo 2, góndola B', abc: 'A', emoji: '🥚', demand: { base: 12, weeklyTrend: 0.04 } },

  // Abarrotes
  { id: 'aba-arroz', name: 'Arroz Costeño extra 1 kg', cat: 'aba', price: 4.9, cost: 3.7, g: 48, a: 240, cap: 60, pack: 12, packLabel: 'Fardo x12', loc: 'Pasillo 3, góndola A', abc: 'A', emoji: '🍚', demand: { base: 30, weeklyTrend: 0.01 } },
  { id: 'aba-azucar', name: 'Azúcar rubia Cartavio 1 kg', cat: 'aba', price: 3.8, cost: 2.9, g: 8, a: 30, cap: 40, pack: 12, packLabel: 'Fardo x12', loc: 'Pasillo 3, góndola B', abc: 'A', emoji: '🍬', demand: { base: 18, weeklyTrend: 0.02 } },
  { id: 'aba-aceite', name: 'Aceite Primor 900 ml', cat: 'aba', price: 9.5, cost: 7.4, g: 4, a: 12, cap: 36, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 3, góndola B', abc: 'A', emoji: '🫒', demand: { base: 16, weeklyTrend: 0.03 } },
  { id: 'aba-fideos', name: 'Fideos Don Vittorio 450 g', cat: 'aba', price: 2.8, cost: 1.95, g: 60, a: 200, cap: 80, pack: 20, packLabel: 'Fardo x20', loc: 'Pasillo 3, góndola C', abc: 'A', emoji: '🍝', demand: { base: 20, weeklyTrend: 0 } },
  { id: 'aba-atun', name: 'Atún Florida 140 g', cat: 'aba', price: 6.2, cost: 4.6, g: 30, a: 48, cap: 36, pack: 24, packLabel: 'Caja x24', loc: 'Pasillo 3, góndola D', abc: 'B', emoji: '🐟', demand: { base: 11, weeklyTrend: 0.02 } },
  { id: 'aba-avena', name: 'Avena 3 Ositos 900 g', cat: 'aba', price: 5.4, cost: 3.9, g: 20, a: 300, cap: 24, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 3, góndola D', abc: 'C', emoji: '🥣', demand: { base: 7, weeklyTrend: -0.03 } },

  // Bebidas
  { id: 'beb-incakola', name: 'Inca Kola 1.5 L', cat: 'beb', price: 6.9, cost: 5.0, g: 30, a: 48, cap: 48, pack: 6, packLabel: 'Pack x6', loc: 'Pasillo 4, góndola A', abc: 'A', emoji: '🥤', demand: { base: 26, weeklyTrend: 0.03, weekday: WEEKEND_STRONG } },
  { id: 'beb-agua', name: 'Agua San Luis 625 ml', cat: 'beb', price: 1.5, cost: 0.9, g: 60, a: 150, cap: 90, pack: 15, packLabel: 'Pack x15', loc: 'Pasillo 4, góndola A', abc: 'A', emoji: '💧', demand: { base: 45, weeklyTrend: 0.05 } },
  { id: 'beb-nectar', name: 'Néctar Frugos durazno 1 L', cat: 'beb', price: 4.8, cost: 3.4, g: 20, a: 60, cap: 24, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 4, góndola B', abc: 'B', emoji: '🧃', demand: { base: 10, weeklyTrend: 0 } },
  { id: 'beb-pilsen', name: 'Cerveza Pilsen 650 ml', cat: 'beb', price: 6.5, cost: 4.9, g: 24, a: 36, cap: 48, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 4, refrigerado', abc: 'A', emoji: '🍺', demand: { base: 20, weeklyTrend: 0.04, weekday: [0.6, 0.6, 0.7, 0.85, 1.35, 1.8, 1.4] } },

  // Limpieza del hogar
  { id: 'lim-bolivar', name: 'Detergente Bolívar 900 g', cat: 'lim', price: 11.9, cost: 9.1, g: 10, a: 40, cap: 18, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 5, góndola A', abc: 'B', emoji: '🧺', demand: { base: 7, weeklyTrend: 0.01 } },
  { id: 'lim-clorox', name: 'Lejía Clorox 1 L', cat: 'lim', price: 3.5, cost: 2.4, g: 15, a: 60, cap: 24, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 5, góndola A', abc: 'B', emoji: '🫧', demand: { base: 8, weeklyTrend: 0 } },
  { id: 'lim-papel', name: 'Papel higiénico Suave x4', cat: 'lim', price: 6.2, cost: 4.5, g: 3, a: 8, cap: 30, pack: 12, packLabel: 'Fardo x12', loc: 'Pasillo 5, góndola B', abc: 'A', emoji: '🧻', demand: { base: 14, weeklyTrend: 0.02 } },
  { id: 'lim-ayudin', name: 'Lavavajilla Ayudín 500 g', cat: 'lim', price: 4.9, cost: 3.5, g: 12, a: 50, cap: 18, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 5, góndola C', abc: 'C', emoji: '🧽', demand: { base: 6, weeklyTrend: 0 } },

  // Cuidado personal
  { id: 'cui-protex', name: 'Jabón Protex 3 x 110 g', cat: 'cui', price: 7.9, cost: 5.7, g: 12, a: 40, cap: 18, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 6, góndola A', abc: 'B', emoji: '🧼', demand: { base: 5, weeklyTrend: 0.01 } },
  { id: 'cui-colgate', name: 'Pasta dental Colgate 75 ml', cat: 'cui', price: 4.5, cost: 3.1, g: 15, a: 60, cap: 24, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 6, góndola A', abc: 'B', emoji: '🪥', demand: { base: 6, weeklyTrend: 0 } },
  { id: 'cui-shampoo', name: 'Shampoo H&S 375 ml', cat: 'cui', price: 18.9, cost: 14.2, g: 6, a: 120, cap: 12, pack: 6, packLabel: 'Caja x6', loc: 'Pasillo 6, góndola B', abc: 'C', emoji: '🧴', demand: { base: 3, weeklyTrend: -0.02 } },

  // Panadería y snacks
  { id: 'pan-molde', name: 'Pan de molde Bimbo', cat: 'pan', price: 8.9, cost: 6.6, g: 8, a: 6, cap: 18, pack: 6, packLabel: 'Bandeja x6', loc: 'Pasillo 7, panadería', abc: 'A', emoji: '🍞', demand: { base: 9, weeklyTrend: 0.02 } },
  { id: 'pan-soda', name: 'Galletas Soda Field x6', cat: 'pan', price: 3.2, cost: 2.2, g: 30, a: 60, cap: 40, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 7, góndola A', abc: 'B', emoji: '🍪', demand: { base: 16, weeklyTrend: 0 } },
  { id: 'pan-lays', name: "Papas Lay's 150 g", cat: 'pan', price: 6.5, cost: 4.6, g: 14, a: 30, cap: 24, pack: 12, packLabel: 'Caja x12', loc: 'Pasillo 7, góndola B', abc: 'B', emoji: '🍟', demand: { base: 8, weeklyTrend: 0.03, weekday: WEEKEND_STRONG } },
  { id: 'pan-sublime', name: 'Chocolate Sublime 30 g', cat: 'pan', price: 1.5, cost: 1.0, g: 40, a: 96, cap: 60, pack: 24, packLabel: 'Display x24', loc: 'Caja, exhibidor', abc: 'A', emoji: '🍫', demand: { base: 25, weeklyTrend: 0.01 } },
];

const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));

export const INITIAL_PRODUCTS: Product[] = SEEDS.map((s, i) => ({
  id: s.id,
  sku: `3A-${s.cat.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
  barcode: `77501${String(10_000_000 + i * 7919).slice(0, 8)}`,
  name: s.name,
  categoryId: s.cat,
  unit: s.unit ?? 'un',
  price: s.price,
  cost: s.cost,
  stockGondola: s.g,
  stockAlmacen: s.a,
  gondolaCapacity: s.cap,
  packSize: s.pack,
  packLabel: s.packLabel,
  leadTimeDays: categoryById.get(s.cat)?.leadTimeDays ?? 2,
  location: s.loc,
  abc: s.abc,
  emoji: s.emoji,
}));

export const DEMAND_PROFILES: Record<string, DemandProfile> = Object.fromEntries(
  SEEDS.map((s) => [s.id, s.demand]),
);
