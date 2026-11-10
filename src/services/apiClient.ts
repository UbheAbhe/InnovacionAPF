/**
 * Cliente de Integración API - Sistema de Inventario Inteligente Tiendas 3A
 * Conecta el MVP (React/Vite en Vercel) con el Backend de Machine Learning (Flask en Render)
 * y la Base de Datos Cloud (Supabase PostgreSQL).
 * Cumple con el Contrato de Integración de la Rúbrica APF3 (Sección 6.3).
 */

export interface MLPredictionRequest {
  sku: string;
  producto_id: string;
  precio: number;
  costo: number;
  stock_actual: number;
  capacidad_gondola?: number;
  pack_size: number;
  categoria_id: string;
  lead_time_dias: number;
  lag_1d: number;
  lag_7d: number;
  media_movil_7d?: number;
  std_movil_7d?: number;
  dia_semana?: number;
  es_fin_de_semana?: number;
  es_quincena?: number;
  nivel_servicio?: number;
}

export interface MLPredictionResponse {
  sku: string;
  producto_id: string;
  demanda_predicha_dia: number;
  demanda_predicha_semana: number;
  stock_seguridad_ss: number;
  punto_reorden_rop: number;
  stock_actual: number;
  dias_cobertura: number;
  riesgo: 'critico' | 'alto' | 'medio' | 'bajo';
  estado_alerta: string;
  requiere_orden: boolean;
  pedido_sugerido_bultos: number;
  pedido_sugerido_unidades: number;
  costo_pedido_estimado: number;
  modelo: string;
  mape_modelo: number;
  timestamp: string;
}

export interface BackendHealth {
  status: string;
  service: string;
  model_loaded: boolean;
  model_algorithm: string;
  model_version: string;
  database_connected: boolean;
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Verifica disponibilidad del backend Flask / Render con timeout de 2 segundos */
export async function checkBackendHealth(): Promise<BackendHealth | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Ejecuta inferencia en vivo con el modelo serializado en Python */
export async function predictWithML(payload: MLPredictionRequest): Promise<MLPredictionResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[ML API] Fallback a motor local TS:', err);
    return null;
  }
}

/** Guarda un movimiento en Supabase mediante la API */
export async function persistMovement(movement: {
  id: string;
  ts: number;
  productId: string;
  type: string;
  qty: number;
  user: string;
  reason?: string;
  amount?: number;
  gondolaAfter: number;
  almacenAfter: number;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movement),
    });
    return res.ok;
  } catch {
    return false;
  }
}
