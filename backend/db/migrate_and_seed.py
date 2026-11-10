import datetime
import math
import random
import sys
import psycopg2
from psycopg2.extras import execute_batch

# Asegurar codificación utf-8 en consola Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Configuración de conexión a Supabase PostgreSQL
DB_URI = "postgresql://postgres:shTEgJDJSqDGpqG5@db.uqkkjfsuvjwyyixcubmt.supabase.co:5432/postgres"

CATEGORIES = [
    {"id": "fv", "name": "Frutas y verduras", "emoji": "🍊", "color_slot": 0, "lead_time_dias": 1},
    {"id": "lac", "name": "Lácteos y huevos", "emoji": "🥛", "color_slot": 1, "lead_time_dias": 2},
    {"id": "aba", "name": "Abarrotes", "emoji": "🍚", "color_slot": 2, "lead_time_dias": 3},
    {"id": "beb", "name": "Bebidas", "emoji": "🥤", "color_slot": 3, "lead_time_dias": 2},
    {"id": "lim", "name": "Limpieza del hogar", "emoji": "🧺", "color_slot": 4, "lead_time_dias": 4},
    {"id": "cui", "name": "Cuidado personal", "emoji": "🧼", "color_slot": 5, "lead_time_dias": 5},
    {"id": "pan", "name": "Panadería y snacks", "emoji": "🍞", "color_slot": 6, "lead_time_dias": 1},
]

WEEKEND_STRONG = [0.82, 0.8, 0.86, 0.95, 1.2, 1.45, 1.25]
MARKET_DAYS = [0.95, 0.9, 0.92, 0.95, 1.05, 1.3, 1.2]
DEFAULT_WEEKDAY = [0.9, 0.88, 0.92, 0.97, 1.1, 1.25, 1.0]

SEEDS = [
    # Frutas y verduras (kg)
    {"id": "fv-mandarina", "name": "Mandarina", "cat": "fv", "unit": "kg", "price": 4.5, "cost": 3.1, "g": 6, "a": 10, "cap": 40, "pack": 10, "packLabel": "Jaba x10 kg", "loc": "Pasillo 1, isla de frutas", "abc": "A", "emoji": "🍊", "base": 18, "trend": 0.08, "weekday": MARKET_DAYS},
    {"id": "fv-platano", "name": "Plátano de seda", "cat": "fv", "unit": "kg", "price": 3.9, "cost": 2.6, "g": 30, "a": 60, "cap": 40, "pack": 10, "packLabel": "Jaba x10 kg", "loc": "Pasillo 1, isla de frutas", "abc": "A", "emoji": "🍌", "base": 22, "trend": 0.01, "weekday": MARKET_DAYS},
    {"id": "fv-manzana", "name": "Manzana delicia", "cat": "fv", "unit": "kg", "price": 5.9, "cost": 4.0, "g": 25, "a": 40, "cap": 35, "pack": 10, "packLabel": "Jaba x10 kg", "loc": "Pasillo 1, isla de frutas", "abc": "B", "emoji": "🍎", "base": 12, "trend": 0.0, "weekday": MARKET_DAYS},
    {"id": "fv-palta", "name": "Palta fuerte", "cat": "fv", "unit": "kg", "price": 8.9, "cost": 6.2, "g": 4, "a": 12, "cap": 25, "pack": 10, "packLabel": "Jaba x10 kg", "loc": "Pasillo 1, isla de frutas", "abc": "B", "emoji": "🥑", "base": 9, "trend": -0.04, "weekday": MARKET_DAYS},
    {"id": "fv-limon", "name": "Limón sutil", "cat": "fv", "unit": "kg", "price": 6.5, "cost": 4.3, "g": 15, "a": 10, "cap": 25, "pack": 10, "packLabel": "Saco x10 kg", "loc": "Pasillo 1, verduras", "abc": "B", "emoji": "🍋", "base": 9, "trend": 0.12, "weekday": MARKET_DAYS},
    {"id": "fv-papa", "name": "Papa amarilla", "cat": "fv", "unit": "kg", "price": 3.6, "cost": 2.4, "g": 50, "a": 100, "cap": 60, "pack": 25, "packLabel": "Saco x25 kg", "loc": "Pasillo 1, verduras", "abc": "A", "emoji": "🥔", "base": 25, "trend": 0.0, "weekday": MARKET_DAYS},
    {"id": "fv-tomate", "name": "Tomate italiano", "cat": "fv", "unit": "kg", "price": 4.2, "cost": 2.8, "g": 18, "a": 20, "cap": 30, "pack": 10, "packLabel": "Jaba x10 kg", "loc": "Pasillo 1, verduras", "abc": "B", "emoji": "🍅", "base": 14, "trend": 0.02, "weekday": MARKET_DAYS},

    # Lácteos y huevos
    {"id": "lac-leche", "name": "Leche Gloria azul 400 g", "cat": "lac", "price": 4.2, "cost": 3.3, "g": 12, "a": 24, "cap": 72, "pack": 24, "packLabel": "Caja x24", "loc": "Pasillo 2, góndola A", "abc": "A", "emoji": "🥛", "base": 40, "trend": 0.03},
    {"id": "lac-yogurt", "name": "Yogurt Gloria fresa 1 L", "cat": "lac", "price": 6.9, "cost": 5.1, "g": 20, "a": 36, "cap": 24, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 2, refrigerado", "abc": "B", "emoji": "🍓", "base": 14, "trend": 0.02},
    {"id": "lac-queso", "name": "Queso fresco Bonlé 500 g", "cat": "lac", "price": 13.9, "cost": 10.2, "g": 10, "a": 18, "cap": 12, "pack": 6, "packLabel": "Caja x6", "loc": "Pasillo 2, refrigerado", "abc": "B", "emoji": "🧀", "base": 6, "trend": 0.0},
    {"id": "lac-mantequilla", "name": "Mantequilla Laive 200 g", "cat": "lac", "price": 8.5, "cost": 6.4, "g": 14, "a": 60, "cap": 18, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 2, refrigerado", "abc": "C", "emoji": "🧈", "base": 5, "trend": -0.02},
    {"id": "lac-huevos", "name": "Huevos rosados x15", "cat": "lac", "price": 9.9, "cost": 7.6, "g": 6, "a": 20, "cap": 20, "pack": 10, "packLabel": "Bandeja x10", "loc": "Pasillo 2, góndola B", "abc": "A", "emoji": "🥚", "base": 12, "trend": 0.04},

    # Abarrotes
    {"id": "aba-arroz", "name": "Arroz Costeño extra 1 kg", "cat": "aba", "price": 4.9, "cost": 3.7, "g": 48, "a": 240, "cap": 60, "pack": 12, "packLabel": "Fardo x12", "loc": "Pasillo 3, góndola A", "abc": "A", "emoji": "🍚", "base": 30, "trend": 0.01},
    {"id": "aba-azucar", "name": "Azúcar rubia Cartavio 1 kg", "cat": "aba", "price": 3.8, "cost": 2.9, "g": 8, "a": 30, "cap": 40, "pack": 12, "packLabel": "Fardo x12", "loc": "Pasillo 3, góndola B", "abc": "A", "emoji": "🍬", "base": 18, "trend": 0.02},
    {"id": "aba-aceite", "name": "Aceite Primor 900 ml", "cat": "aba", "price": 9.5, "cost": 7.4, "g": 4, "a": 12, "cap": 36, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 3, góndola B", "abc": "A", "emoji": "🫒", "base": 16, "trend": 0.03},
    {"id": "aba-fideos", "name": "Fideos Don Vittorio 450 g", "cat": "aba", "price": 2.8, "cost": 1.95, "g": 60, "a": 200, "cap": 80, "pack": 20, "packLabel": "Fardo x20", "loc": "Pasillo 3, góndola C", "abc": "A", "emoji": "🍝", "base": 20, "trend": 0.0},
    {"id": "aba-atun", "name": "Atún Florida 140 g", "cat": "aba", "price": 6.2, "cost": 4.6, "g": 30, "a": 48, "cap": 36, "pack": 24, "packLabel": "Caja x24", "loc": "Pasillo 3, góndola D", "abc": "B", "emoji": "🐟", "base": 11, "trend": 0.02},
    {"id": "aba-avena", "name": "Avena 3 Ositos 900 g", "cat": "aba", "price": 5.4, "cost": 3.9, "g": 20, "a": 300, "cap": 24, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 3, góndola D", "abc": "C", "emoji": "🥣", "base": 7, "trend": -0.03},

    # Bebidas
    {"id": "beb-incakola", "name": "Inca Kola 1.5 L", "cat": "beb", "price": 6.9, "cost": 5.0, "g": 30, "a": 48, "cap": 48, "pack": 6, "packLabel": "Pack x6", "loc": "Pasillo 4, góndola A", "abc": "A", "emoji": "🥤", "base": 26, "trend": 0.03, "weekday": WEEKEND_STRONG},
    {"id": "beb-agua", "name": "Agua San Luis 625 ml", "cat": "beb", "price": 1.5, "cost": 0.9, "g": 60, "a": 150, "cap": 90, "pack": 15, "packLabel": "Pack x15", "loc": "Pasillo 4, góndola A", "abc": "A", "emoji": "💧", "base": 45, "trend": 0.05},
    {"id": "beb-nectar", "name": "Néctar Frugos durazno 1 L", "cat": "beb", "price": 4.8, "cost": 3.4, "g": 20, "a": 60, "cap": 24, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 4, góndola B", "abc": "B", "emoji": "🧃", "base": 10, "trend": 0.0},
    {"id": "beb-pilsen", "name": "Cerveza Pilsen 650 ml", "cat": "beb", "price": 6.5, "cost": 4.9, "g": 24, "a": 36, "cap": 48, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 4, refrigerado", "abc": "A", "emoji": "🍺", "base": 20, "trend": 0.04, "weekday": [0.6, 0.6, 0.7, 0.85, 1.35, 1.8, 1.4]},

    # Limpieza del hogar
    {"id": "lim-bolivar", "name": "Detergente Bolívar 900 g", "cat": "lim", "price": 11.9, "cost": 9.1, "g": 10, "a": 40, "cap": 18, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 5, góndola A", "abc": "B", "emoji": "🧺", "base": 7, "trend": 0.01},
    {"id": "lim-clorox", "name": "Lejía Clorox 1 L", "cat": "lim", "price": 3.5, "cost": 2.4, "g": 15, "a": 60, "cap": 24, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 5, góndola A", "abc": "B", "emoji": "🫧", "base": 8, "trend": 0.0},
    {"id": "lim-papel", "name": "Papel higiénico Suave x4", "cat": "lim", "price": 6.2, "cost": 4.5, "g": 3, "a": 8, "cap": 30, "pack": 12, "packLabel": "Fardo x12", "loc": "Pasillo 5, góndola B", "abc": "A", "emoji": "🧻", "base": 14, "trend": 0.02},
    {"id": "lim-ayudin", "name": "Lavavajilla Ayudín 500 g", "cat": "lim", "price": 4.9, "cost": 3.5, "g": 12, "a": 50, "cap": 18, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 5, góndola C", "abc": "C", "emoji": "🧽", "base": 6, "trend": 0.0},

    # Cuidado personal
    {"id": "cui-protex", "name": "Jabón Protex 3 x 110 g", "cat": "cui", "price": 7.9, "cost": 5.7, "g": 12, "a": 40, "cap": 18, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 6, góndola A", "abc": "B", "emoji": "🧼", "base": 5, "trend": 0.01},
    {"id": "cui-colgate", "name": "Pasta dental Colgate 75 ml", "cat": "cui", "price": 4.5, "cost": 3.1, "g": 15, "a": 60, "cap": 24, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 6, góndola A", "abc": "B", "emoji": "🪥", "base": 6, "trend": 0.0},
    {"id": "cui-shampoo", "name": "Shampoo H&S 375 ml", "cat": "cui", "price": 18.9, "cost": 14.2, "g": 6, "a": 120, "cap": 12, "pack": 6, "packLabel": "Caja x6", "loc": "Pasillo 6, góndola B", "abc": "C", "emoji": "🧴", "base": 3, "trend": -0.02},

    # Panadería y snacks
    {"id": "pan-molde", "name": "Pan de molde Bimbo", "cat": "pan", "price": 8.9, "cost": 6.6, "g": 8, "a": 6, "cap": 18, "pack": 6, "packLabel": "Bandeja x6", "loc": "Pasillo 7, panadería", "abc": "A", "emoji": "🍞", "base": 9, "trend": 0.02},
    {"id": "pan-soda", "name": "Galletas Soda Field x6", "cat": "pan", "price": 3.2, "cost": 2.2, "g": 30, "a": 60, "cap": 40, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 7, góndola A", "abc": "B", "emoji": "🍪", "base": 16, "trend": 0.0},
    {"id": "pan-lays", "name": "Papas Lay's 150 g", "cat": "pan", "price": 6.5, "cost": 4.6, "g": 14, "a": 30, "cap": 24, "pack": 12, "packLabel": "Caja x12", "loc": "Pasillo 7, góndola B", "abc": "B", "emoji": "🍟", "base": 8, "trend": 0.03, "weekday": WEEKEND_STRONG},
    {"id": "pan-sublime", "name": "Chocolate Sublime 30 g", "cat": "pan", "price": 1.5, "cost": 1.0, "g": 40, "a": 96, "cap": 60, "pack": 24, "packLabel": "Display x24", "loc": "Caja, exhibidor", "abc": "A", "emoji": "🍫", "base": 25, "trend": 0.01},
]

def payday_factor(d: datetime.date) -> float:
    day = d.day
    # Días de pago de quincena en Perú (15, 16, fin de mes, 1)
    if day in (15, 16, 1) or day >= 30:
        return 1.15
    return 1.0

def main():
    print("=== Conectando a Supabase PostgreSQL ===")
    conn = psycopg2.connect(DB_URI)
    conn.autocommit = False
    cur = conn.cursor()

    # 1. Leer y ejecutar schema.sql
    import os
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    print("Ejecutando schema.sql...")
    cur.execute(schema_sql)
    conn.commit()
    print("✓ Tablas e índices creados con éxito.")

    # 2. Insertar Categorías
    cat_query = """
    INSERT INTO categorias (id, nombre, emoji, color_slot, lead_time_dias)
    VALUES (%(id)s, %(name)s, %(emoji)s, %(color_slot)s, %(lead_time_dias)s)
    ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        emoji = EXCLUDED.emoji,
        color_slot = EXCLUDED.color_slot,
        lead_time_dias = EXCLUDED.lead_time_dias;
    """
    execute_batch(cur, cat_query, CATEGORIES)
    conn.commit()
    print(f"✓ {len(CATEGORIES)} categorías insertadas/actualizadas.")

    # 3. Insertar Productos
    cat_lead_map = {c["id"]: c["lead_time_dias"] for c in CATEGORIES}
    products = []
    for i, s in enumerate(SEEDS):
        sku = f"3A-{s['cat'].upper()}-{str(i+1).zfill(3)}"
        barcode = f"77501{str(10000000 + i * 7919)[:8]}"
        products.append({
            "id": s["id"],
            "sku": sku,
            "codigo_barras": barcode,
            "nombre": s["name"],
            "categoria_id": s["cat"],
            "unidad": s.get("unit", "un"),
            "precio": s["price"],
            "costo": s["cost"],
            "stock_gondola": s["g"],
            "stock_almacen": s["a"],
            "capacidad_gondola": s["cap"],
            "pack_size": s["pack"],
            "pack_label": s["packLabel"],
            "lead_time_dias": cat_lead_map.get(s["cat"], 2),
            "ubicacion": s["loc"],
            "abc": s["abc"],
            "emoji": s["emoji"],
            "origen": "simulado"
        })

    prod_query = """
    INSERT INTO productos (
        id, sku, codigo_barras, nombre, categoria_id, unidad,
        precio, costo, stock_gondola, stock_almacen, capacidad_gondola,
        pack_size, pack_label, lead_time_dias, ubicacion, abc, emoji, origen
    ) VALUES (
        %(id)s, %(sku)s, %(codigo_barras)s, %(nombre)s, %(categoria_id)s, %(unidad)s,
        %(precio)s, %(costo)s, %(stock_gondola)s, %(stock_almacen)s, %(capacidad_gondola)s,
        %(pack_size)s, %(pack_label)s, %(lead_time_dias)s, %(ubicacion)s, %(abc)s, %(emoji)s, %(origen)s
    ) ON CONFLICT (id) DO UPDATE SET
        precio = EXCLUDED.precio,
        costo = EXCLUDED.costo,
        stock_gondola = EXCLUDED.stock_gondola,
        stock_almacen = EXCLUDED.stock_almacen,
        capacidad_gondola = EXCLUDED.capacidad_gondola,
        lead_time_dias = EXCLUDED.lead_time_dias;
    """
    execute_batch(cur, prod_query, products)
    conn.commit()
    print(f"✓ {len(products)} productos insertados/actualizados.")

    # 4. Generar Historial de Ventas (90 días de historial)
    print("Generando 90 días de historial de ventas diarias...")
    random.seed(42) # Semilla fija para reproducibilidad exigida en rúbrica
    today = datetime.date(2026, 11, 9)
    days_history = 90
    sales_records = []

    for s in SEEDS:
        prod_id = s["id"]
        price = s["price"]
        unit = s.get("unit", "un")
        weekday_weights = s.get("weekday", DEFAULT_WEEKDAY)

        for d_offset in range(days_history, 0, -1):
            date_curr = today - datetime.timedelta(days=d_offset)
            weekday_idx = date_curr.weekday() # 0 = Lunes, 6 = Domingo
            weeks_diff = (days_history - d_offset) / 7.0
            trend_factor = max(0.4, 1.0 + s["trend"] * weeks_diff)
            w_factor = weekday_weights[weekday_idx]
            payday = payday_factor(date_curr)

            expected_base = s["base"] * w_factor * trend_factor * payday
            noise = max(0.55, 1.0 + random.gauss(0, 0.15))
            units_raw = expected_base * noise

            if unit == "kg":
                units_sold = round(units_raw, 1)
            else:
                units_sold = max(0, round(units_raw))

            revenue = round(units_sold * price, 2)
            is_weekend = weekday_idx in (4, 5, 6) # Viernes, Sábado, Domingo
            is_payday_flag = (payday > 1.0)

            sales_records.append({
                "fecha": date_curr,
                "producto_id": prod_id,
                "unidades_vendidas": units_sold,
                "ingresos_soles": revenue,
                "dia_semana": weekday_idx,
                "es_fin_de_semana": is_weekend,
                "es_quincena": is_payday_flag,
                "origen": "simulado"
            })

    sales_query = """
    INSERT INTO historial_ventas (
        fecha, producto_id, unidades_vendidas, ingresos_soles,
        dia_semana, es_fin_de_semana, es_quincena, origen
    ) VALUES (
        %(fecha)s, %(producto_id)s, %(unidades_vendidas)s, %(ingresos_soles)s,
        %(dia_semana)s, %(es_fin_de_semana)s, %(es_quincena)s, %(origen)s
    ) ON CONFLICT (fecha, producto_id) DO UPDATE SET
        unidades_vendidas = EXCLUDED.unidades_vendidas,
        ingresos_soles = EXCLUDED.ingresos_soles;
    """
    execute_batch(cur, sales_query, sales_records, page_size=500)
    conn.commit()
    print(f"✓ {len(sales_records)} registros diarios de ventas insertados en historial_ventas.")

    # 5. Insertar movimientos iniciales de Kardex
    kardex_records = [
        {
            "id": "MV-INIT-001", "ts": 1794236400000, "fecha_hora": "2026-11-09 08:30:00-05",
            "producto_id": "beb-agua", "tipo": "ENTRADA", "cantidad": 60, "usuario": "Centro de distribución",
            "motivo": "Guía de remisión GR-004821", "monto": 54.0, "gondola_despues": 60, "almacen_despues": 150, "origen": "simulado"
        },
        {
            "id": "MV-INIT-002", "ts": 1794240000000, "fecha_hora": "2026-11-09 09:30:00-05",
            "producto_id": "lac-leche", "tipo": "REPOSICION", "cantidad": 24, "usuario": "Rosa (reposición)",
            "motivo": "Reposición interna a góndola", "monto": None, "gondola_despues": 12, "almacen_despues": 24, "origen": "simulado"
        },
        {
            "id": "MV-INIT-003", "ts": 1794243600000, "fecha_hora": "2026-11-09 10:30:00-05",
            "producto_id": "lac-yogurt", "tipo": "MERMA", "cantidad": 2, "usuario": "Luis (almacén)",
            "motivo": "Vencimiento / rotura de sello", "monto": 13.8, "gondola_despues": 20, "almacen_despues": 36, "origen": "simulado"
        },
        {
            "id": "MV-INIT-004", "ts": 1794247200000, "fecha_hora": "2026-11-09 11:30:00-05",
            "producto_id": "aba-arroz", "tipo": "REPOSICION", "cantidad": 24, "usuario": "Rosa (reposición)",
            "motivo": "Reposición interna a góndola", "monto": None, "gondola_despues": 48, "almacen_despues": 240, "origen": "simulado"
        }
    ]

    kardex_query = """
    INSERT INTO movimientos_kardex (
        id, ts, fecha_hora, producto_id, tipo, cantidad, usuario, motivo, monto,
        gondola_despues, almacen_despues, origen
    ) VALUES (
        %(id)s, %(ts)s, %(fecha_hora)s, %(producto_id)s, %(tipo)s, %(cantidad)s,
        %(usuario)s, %(motivo)s, %(monto)s, %(gondola_despues)s, %(almacen_despues)s, %(origen)s
    ) ON CONFLICT (id) DO NOTHING;
    """
    execute_batch(cur, kardex_query, kardex_records)
    conn.commit()
    print(f"✓ {len(kardex_records)} movimientos iniciales de Kardex insertados.")

    # 6. Insertar órdenes de compra iniciales
    orders = [
        {"id": "OC-2026-001", "producto_id": "aba-aceite", "cantidad": 24, "bultos": 2, "costo_total": 177.6, "fecha_emision": "2026-11-07", "fecha_entrega_esperada": "2026-11-10", "estado": "pendiente", "origen": "simulado"},
        {"id": "OC-2026-002", "producto_id": "lim-papel", "cantidad": 24, "bultos": 2, "costo_total": 108.0, "fecha_emision": "2026-11-07", "fecha_entrega_esperada": "2026-11-11", "estado": "pendiente", "origen": "simulado"},
        {"id": "OC-2026-003", "producto_id": "lac-yogurt", "cantidad": 24, "bultos": 2, "costo_total": 122.4, "fecha_emision": "2026-11-04", "fecha_entrega_esperada": "2026-11-06", "estado": "recibido", "origen": "simulado"},
    ]
    order_query = """
    INSERT INTO ordenes_compra (
        id, producto_id, cantidad, bultos, costo_total, fecha_emision,
        fecha_entrega_esperada, estado, origen
    ) VALUES (
        %(id)s, %(producto_id)s, %(cantidad)s, %(bultos)s, %(costo_total)s,
        %(fecha_emision)s, %(fecha_entrega_esperada)s, %(estado)s, %(origen)s
    ) ON CONFLICT (id) DO NOTHING;
    """
    execute_batch(cur, order_query, orders)
    conn.commit()
    print(f"✓ {len(orders)} órdenes de compra iniciales insertadas.")

    # 7. Resumen de conteos
    cur.execute("SELECT count(*) FROM categorias;")
    num_cat = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM productos;")
    num_prod = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM historial_ventas;")
    num_sales = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM movimientos_kardex;")
    num_kardex = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM ordenes_compra;")
    num_orders = cur.fetchone()[0]

    print("\n================ RESUMEN SUPABASE ================")
    print(f"Categorías:         {num_cat}")
    print(f"Productos:          {num_prod}")
    print(f"Ventas Históricas:  {num_sales} filas (Dataset APF3)")
    print(f"Kardex:             {num_kardex} movimientos")
    print(f"Órdenes de compra:  {num_orders}")
    print("==================================================")

    cur.close()
    conn.close()
    print("¡Base de datos migrada y poblada exitosamente en Supabase!")

if __name__ == "__main__":
    main()
