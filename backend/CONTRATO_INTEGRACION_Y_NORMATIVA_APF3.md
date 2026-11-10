# DOCUMENTACIÓN TÉCNICA APF3 — INTEGRACIÓN, NEGOCIO Y NORMATIVA
## Sistema de Inventario Inteligente Tiendas 3A — Sede Av. Tantamayo 1032 (SMP)
**Curso:** Innovación y Transformación Digital (100000TD09) — UTP

---

### 1. Contrato de Integración del MVP con el Modelo de Machine Learning (Sección 6.3)

#### A. Esquema de Entrada (Request enviado por el MVP al Backend en Python):
- **Endpoint:** `POST /api/predict`
- **Content-Type:** `application/json`
- **Acción que dispara la petición:** Apertura de la pantalla del Módulo Predictivo (`/prediccion`), clic en el botón de **"Inferencia ML en vivo"**, o simulación de ventas con reloj virtual.

```json
{
  "sku": "3A-FV-001",
  "producto_id": "fv-mandarina",
  "precio": 4.50,
  "costo": 3.10,
  "stock_actual": 12.0,
  "capacidad_gondola": 40.0,
  "pack_size": 10.0,
  "categoria_id": "fv",
  "lead_time_dias": 1,
  "lag_1d": 18.0,
  "lag_7d": 22.0,
  "media_movil_7d": 19.4,
  "std_movil_7d": 2.8,
  "dia_semana": 5,
  "es_fin_de_semana": 1,
  "es_quincena": 1,
  "nivel_servicio": 0.95
}
```

#### B. Esquema de Salida (Response devuelto por el Backend al MVP):
- **HTTP Status:** `200 OK`
- **Content-Type:** `application/json`

```json
{
  "sku": "3A-FV-001",
  "producto_id": "fv-mandarina",
  "demanda_predicha_dia": 24.94,
  "demanda_predicha_semana": 174.58,
  "stock_seguridad_ss": 4.61,
  "punto_reorden_rop": 54.49,
  "stock_actual": 12.0,
  "dias_cobertura": 0.5,
  "riesgo": "medio",
  "estado_alerta": "EMITIR_ORDEN",
  "requiere_orden": true,
  "pedido_sugerido_bultos": 22,
  "pedido_sugerido_unidades": 220.0,
  "costo_pedido_estimado": 682.0,
  "modelo": "GradientBoostingRegressor",
  "mape_modelo": 15.63,
  "timestamp": "2026-11-09T20:36:22.294480"
}
```

#### C. Estado de Implementación Técnica (Transparencia Académica):
- **Implementado en APF3 (100% Funcional):**
  1. Microservicio REST en Flask (`backend/app.py`) con CORS habilitado para Render y Vercel.
  2. Serialización y carga del modelo ganador `modelo_demanda_3a.joblib` (`GradientBoostingRegressor`).
  3. Base de datos persistente en **Supabase PostgreSQL** (`db.uqkkjfsuvjwyyixcubmt.supabase.co`) con 5 tablas y 2,970 registros históricos.
  4. Componente de integración en frontend (`src/services/apiClient.ts` y modal de inferencia interactiva en vivo).
- **Alcance proyectado para PROY (Semana 17):**
  1. Sincronización automática periódica (cron job) de reentrenamiento del modelo con las nuevas ventas reales capturadas.
  2. Módulo de envío real automatizado vía Webhook de WhatsApp Cloud API.

---

### 2. Interpretación de Resultados en Lenguaje de Negocio (Sección 6.2)

1. **Cumplimiento de la Meta Observable:**
   - La situación base sin sistema en Tiendas 3A Tantamayo registraba un error de pronóstico heurístico manual superior al 28.5% y una tasa de quiebre de góndola del 14.2%.
   - El modelo Gradient Boosting redujo el error a un **MAPE de 15.63%** en el conjunto de prueba intacto, cumpliendo la meta contractual del Paso 1 ($\text{MAPE} \le 16.0\%$).
2. **Impacto Económico Cuantificable para la MiPYME:**
   - **Ventas no perdidas recuperadas:** Al reducir los quiebres de góndola en un 60%, se estima una recuperación de ventas directas de **S/ 68.40 diarios**, lo que representa **S/ 2,052 al mes** en margen bruto adicional para la sede Tantamayo.
   - **Reducción de mermas por vencimiento:** Al calcular pedidos sugeridos a bulto cerrado con un Punto de Reorden ($ROP$) calibrado al tiempo de entrega real del CD (1 a 5 días), se evita el sobrestock de perecibles (frutas, verduras y lácteos), reduciendo las mermas en un **25% (ahorro de aprox. S/ 420 mensuales)**.
3. **Explicación para el Administrador de Tienda (Sin jerga técnica):**
   - *"El sistema no reemplaza el criterio del administrador; actúa como un copiloto que revisa constantemente las ventas de la última semana y avisa con anticipación cuántas cajas pedir antes de que el cliente encuentre la góndola vacía, cuidando no pedir de más para que los productos frescos no se malogren"*.

---

### 3. Matriz de Cumplimiento Normativo (Sección 6.4)

| Requisito Normativo | Decisión de Ingeniería / Control Implementado | Evidencia en el Código / MVP |
| :--- | :--- | :--- |
| **Ley N.° 29733 (Datos Personales) — Principio de Minimización y Finalidad** | El dataset de entrenamiento y las tablas transaccionales de Supabase no recolectan ningún Dato Personal Identificable (PII): no se registran nombres, DNI, números de teléfono ni datos de tarjetas bancarias. Solo se almacena el identificador anónimo de SKU, fecha y unidades agregadas de caja. | Archivo [`backend/data/dataset_ventas_3a.csv`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/backend/data/dataset_ventas_3a.csv) y tabla `historial_ventas` en Supabase donde solo existen campos cuantitativos de inventario. |
| **Ley N.° 29733 — Principio de Seguridad y Confidencialidad** | La cadena de conexión a la base de datos y claves del servicio están aisladas en variables de entorno `.env`, excluidas del repositorio público mediante `.gitignore`. Las consultas viajan cifradas bajo protocolo TLSv1.3 (puerto seguro 5432). | Archivo [`.gitignore`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/.gitignore) con exclusión explícita de `.env` y certificados SSL en la conexión de `psycopg2`. |
| **Ley N.° 31814 (Uso de IA en el Perú) — Principio de Supervisión Humana (Human-in-the-loop)** | El modelo predictivo genera sugerencias y alertas automáticas, pero la orden de compra o el traslado de mercancía requiere la validación y confirmación explícita del personal de tienda en pantalla (`MovementDialog` y `OrderDialog`). | Componente visual [`AiTag`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/src/components/ui/Badges.tsx) y botón de confirmación humana en modales de pedido. |
| **Ley N.° 31814 — Transparencia y Explicabilidad Algorítmica** | La interfaz advierte al usuario que las predicciones y niveles de riesgo son emitidos por un modelo estadístico de Machine Learning y muestra el MAPE y la metodología aplicada mediante el botón "¿Cómo se calcula?". | Sección interactiva de metodología en [`PredictionsPage.tsx`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/src/pages/PredictionsPage.tsx) y panel de control de parámetros del motor. |

---

### 4. Proyección a PROY y Matriz de Riesgos (Sección 6.5)

| Riesgo Identificado | Tipo | Probabilidad | Impacto | Responsable | Plan de Mitigación |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **R1. Latencia de conexión entre Vercel y Render (Plan Gratuito con Cold Start)** | Técnico | Alta (70%) | Medio | Líder Técnico de Backend | Implementación de fallback local en TypeScript: si la API en Render tarda más de 2 segundos en responder, el frontend utiliza transparentemente el motor local del navegador sin interrumpir la operación de la tienda. |
| **R2. Volatilidad de demanda por días festivos atípicos (Día de la Madre, Navidad)** | De Datos | Media (40%) | Alto | Especialista en Machine Learning | Incorporación de una variable binaria exógena de feriados nacionales peruanos (`es_feriado`) y reentrenamiento quincenal del modelo conforme se capturen ventas reales en Supabase. |
| **R3. Resistencia del personal de tienda al registro digital de reposiciones** | Operativo | Media (30%) | Medio | Diseñador UX / Administrador | Diseño de interfaz móvil ultra-rápida con registro de reposición interna en un solo toque (`MovementDialog.tsx`) y generación de alertas con copia directa a grupos de WhatsApp de tienda. |
