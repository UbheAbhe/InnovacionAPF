-- ====================================================================
-- SCHEMA INVENTARIO INTELIGENTE 3A - SEDE AV. TANTAMAYO 1032 (SMP)
-- Base de Datos PostgreSQL / Supabase
-- Proyecto: Innovación y Transformación Digital (UTP - APF3 / PROY)
-- ====================================================================

-- 1. Categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
    id VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    emoji VARCHAR(10),
    color_slot INT DEFAULT 0,
    lead_time_dias INT DEFAULT 2
);

-- 2. Catálogo de productos (33 SKUs)
CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(50) PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    codigo_barras VARCHAR(50),
    nombre VARCHAR(150) NOT NULL,
    categoria_id VARCHAR(20) REFERENCES categorias(id) ON DELETE CASCADE,
    unidad VARCHAR(10) NOT NULL DEFAULT 'un',
    precio NUMERIC(10, 2) NOT NULL,
    costo NUMERIC(10, 2) NOT NULL,
    stock_gondola NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stock_almacen NUMERIC(10, 2) NOT NULL DEFAULT 0,
    capacidad_gondola NUMERIC(10, 2) NOT NULL,
    pack_size NUMERIC(10, 2) NOT NULL DEFAULT 1,
    pack_label VARCHAR(50) NOT NULL,
    lead_time_dias INT NOT NULL DEFAULT 2,
    ubicacion VARCHAR(100),
    abc VARCHAR(2) NOT NULL DEFAULT 'B',
    emoji VARCHAR(10),
    origen VARCHAR(20) NOT NULL DEFAULT 'simulado',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Historial de ventas diarias (Dataset oficial para Machine Learning)
CREATE TABLE IF NOT EXISTS historial_ventas (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    producto_id VARCHAR(50) REFERENCES productos(id) ON DELETE CASCADE,
    unidades_vendidas NUMERIC(10, 2) NOT NULL,
    ingresos_soles NUMERIC(10, 2) NOT NULL,
    dia_semana INT NOT NULL,
    es_fin_de_semana BOOLEAN NOT NULL DEFAULT FALSE,
    es_quincena BOOLEAN NOT NULL DEFAULT FALSE,
    origen VARCHAR(20) NOT NULL DEFAULT 'simulado',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_fecha_producto UNIQUE (fecha, producto_id)
);

-- 4. Movimientos de Kardex (Trazabilidad y auditoría de tienda)
CREATE TABLE IF NOT EXISTS movimientos_kardex (
    id VARCHAR(50) PRIMARY KEY,
    ts BIGINT NOT NULL,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    producto_id VARCHAR(50) REFERENCES productos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL,
    cantidad NUMERIC(10, 2) NOT NULL,
    usuario VARCHAR(100) NOT NULL,
    motivo TEXT,
    monto NUMERIC(10, 2),
    gondola_despues NUMERIC(10, 2) NOT NULL,
    almacen_despues NUMERIC(10, 2) NOT NULL,
    origen VARCHAR(20) NOT NULL DEFAULT 'simulado'
);

-- 5. Órdenes de compra / Pedidos a CD
CREATE TABLE IF NOT EXISTS ordenes_compra (
    id VARCHAR(50) PRIMARY KEY,
    producto_id VARCHAR(50) REFERENCES productos(id) ON DELETE CASCADE,
    cantidad NUMERIC(10, 2) NOT NULL,
    bultos INT NOT NULL,
    costo_total NUMERIC(10, 2) NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_entrega_esperada DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    origen VARCHAR(20) NOT NULL DEFAULT 'simulado',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Predicciones y alertas de Machine Learning
CREATE TABLE IF NOT EXISTS predicciones_ml (
    id SERIAL PRIMARY KEY,
    fecha_calculo DATE NOT NULL,
    producto_id VARCHAR(50) REFERENCES productos(id) ON DELETE CASCADE,
    consumo_promedio_7d NUMERIC(10, 2),
    demanda_predicha_7d NUMERIC(10, 2),
    tendencia_semanal NUMERIC(10, 4),
    stock_seguridad NUMERIC(10, 2),
    punto_reorden NUMERIC(10, 2),
    dias_para_agotarse NUMERIC(10, 2),
    probabilidad_quiebre NUMERIC(10, 4),
    riesgo VARCHAR(20),
    pedido_sugerido_bultos INT DEFAULT 0,
    pedido_sugerido_unidades NUMERIC(10, 2) DEFAULT 0,
    modelo_version VARCHAR(50) DEFAULT 'scikit-learn-v1',
    mape_backtest NUMERIC(10, 2),
    origen VARCHAR(20) NOT NULL DEFAULT 'simulado',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para alto rendimiento
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_historial_prod ON historial_ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_kardex_ts ON movimientos_kardex(ts DESC);
CREATE INDEX IF NOT EXISTS idx_kardex_prod ON movimientos_kardex(producto_id);
CREATE INDEX IF NOT EXISTS idx_pred_fecha_prod ON predicciones_ml(fecha_calculo, producto_id);
