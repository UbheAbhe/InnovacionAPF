# GUÍA Y CONTENIDO TÉCNICO COMPLETO PARA EL INFORME APF3 (WORD)
## Sistema de Inventario Inteligente Tiendas 3A — Sede Av. Tantamayo 1032, SMP
**Curso:** Innovación y Transformación Digital (100000TD09) — UTP | 2026-2  
**Integrantes:** Orestes Moran, Grace Campos, Julio Minaya, Jardiel Damian  
**Docente:** Richard Enrique Caman Sanchez  

---

> [!NOTE]  
> **Instrucciones para armar el Word:**  
> Este documento contiene los textos, tablas, análisis de errores, contratos de integración y matrices normativas requeridas por la **Rúbrica Oficial de APF3** (máximo 15 páginas). Puedes copiar y pegar directamente cada sección en la plantilla del informe.

---

# 1. Resumen Ejecutivo y Definición del Problema ML (Paso 1 · 3 pts)

### 1.1. Continuidad y Trazabilidad desde APF1 y APF2
El presente informe mantiene estricta continuidad con el diagnóstico (APF1) y el desarrollo del MVP (APF2). Se ratifica la misma MiPYME (**Tiendas 3A / AJILES PERU S.A.C., RUC 20612232203**, formato *hard discount*, sucursal Av. Tantamayo 1032, San Martín de Porres), el mismo equipo de cuatro integrantes y el mismo problema de ingeniería: la **falta de un sistema de inventario inteligente y predictivo para medir y reducir los quiebres de stock en góndola durante las horas pico de atención**.

En el APF2 se construyó y desplegó en Vercel un MVP interactivo con simulador de ventas y lógica logística. En este **APF3**, se materializan los componentes planificados en la arquitectura preliminar:
1. Una base de datos relacional persistente en la nube (**Supabase PostgreSQL**).
2. Un pipeline completo de **Machine Learning supervisado en Python** (`scikit-learn`, `pandas`) para el pronóstico de demanda diaria.
3. Un microservicio **REST API en Flask** que expone la inferencia del modelo serializado (`.joblib`) y se integra con la interfaz web y móvil del MVP.

### 1.2. Tipificación del Problema de Machine Learning
- **Tipo de Problema:** **Regresión de valor continuo de series temporales con variables exógenas**.
- **Variable Objetivo ($Target$):** `unidades_vendidas` (número de unidades o kilogramos de demanda diaria por cada producto).
- **Unidad de Observación:** 1 registro = 1 producto específico (`sku`) en una fecha de calendario determinada (`fecha`).
- **Decisión de Negocio que Habilita:** El modelo reemplaza la estimación manual reactiva. Sus predicciones alimentan de forma automatizada el cálculo del **Stock de Seguridad ($SS$)** y del **Punto de Reorden ($ROP$)**, generando la orden de compra sugerida a bulto cerrado antes de que se produzca el desabastecimiento físico en góndola.
- **Métrica de Negocio Observable:** Reducir el error de pronóstico de la tienda de un MAPE base del **28.5%** a un **MAPE $\le 16.0\%$**, reduciendo la tasa de quiebre de stock del 10.2% a menos del 5.0% y evitando ventas perdidas por más de S/ 68.00 diarios.
- **Costo Asimétrico de los Errores:**
  - *Subestimar la demanda ($\hat{y} < y$):* Provoca góndolas vacías en horas punta, pérdida directa de ingresos y fuga del cliente hacia la competencia informal de la Av. Tantamayo (**costo crítico para el negocio**).
  - *Sobrestimar la demanda ($\hat{y} > y$):* Provoca sobrestock en trastienda y merma por vencimiento en categorías perecibles como frutas, verduras o lácteos (**costo moderado**).
  - *Criterio de ingeniería:* Se prioriza penalizar el error de subestimación mediante un stock de seguridad calibrado al 95% de nivel de servicio ($z = 1.645$).

> **Frase Reglamentaria del Problema ML (Consigna Sec. 3):**  
> *"Para el Administrador y el personal de reposición de Tiendas 3A (Sede Av. Tantamayo), el modelo **predecirá la demanda diaria por SKU** con el propósito de **anticipar los quiebres de góndola y generar órdenes de compra automáticas**, medido mediante un **MAPE $\le 16.0\%$ en el conjunto de prueba** y una **reducción de ventas perdidas a menos de S/ 80.00 diarios**."*

---

# 2. Dataset, Coherencia de Datos y Preprocesamiento (Paso 2 · 4 pts)

### 2.1. Descripción y Trazabilidad del Dataset
El dataset se deriva del Contrato de Datos Preliminar de la Tabla 12 del APF2 y se encuentra alojado en la base de datos **Supabase PostgreSQL** (`db.uqkkjfsuvjwyyixcubmt.supabase.co`), desde donde fue exportado como [`dataset_ventas_3a.csv`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/backend/data/dataset_ventas_3a.csv).
- **Volumen total:** **2,970 registros diarios** (90 días de calendario continuo $\times$ 33 SKUs), superando ampliamente el umbral mínimo orientativo de 200 filas exigido por la consigna.
- **Rotulado obligatorio:** El 100% de los registros incluye la columna **`origen = 'simulado'`**, cumpliendo la directiva estricta de la sección 4.1.

### 2.2. Ficha de Coherencia de Datos (Los 7 Criterios de la Sección 4.2)

| Criterio Evaluado | Verificación Realizada | Evidencia / Justificación de Negocio |
| :--- | :--- | :--- |
| **1. Escala del negocio** | Volúmenes y montos acordes al formato *hard discount* de Tiendas 3A en San Martín de Porres. | Demandas promedio entre 15 y 45 unidades/día para artículos de alta rotación (Leche Gloria, Arroz, Agua San Luis) y de 4 a 12 unidades para baja rotación. |
| **2. Rangos y unidades** | Valores estrictamente no negativos, precios reales de góndola en soles peruanos y unidades homogéneas. | Sin precios en cero ni stocks negativos. Precios entre S/ 1.50 y S/ 18.90. Unidades rotuladas como `kg` (granel) y `un` (discretos). |
| **3. Consistencia lógica y temporal** | Orden cronológico estricto sin saltos temporales ni ventas en fechas futuras. | Registros ordenados desde el `2026-08-11` hasta el `2026-11-08`. Inventario consistente con entradas y salidas de Kardex. |
| **4. Relaciones plausibles** | Patrones socioeconómicos verificables del retail peruano reflejados en la demanda. | Incremento de demanda del 20% al 45% los días viernes, sábados y domingos (compras de fin de semana) y factor del 1.15x en días de quincena (días 15, 16, 30 y 1). |
| **5. Señal ni nula ni perfecta** | El target depende de las variables predictivas sin caer en separación trivial ni ruido puro. | El modelo alcanza un $R^2 = 0.923$ y MAPE = $15.63\%$. No existen métricas artificialmente perfectas ($R^2 \ge 0.99$), lo que valida la presencia de ruido estocástico real. |
| **6. Coherencia con APF2** | Campos y tipos idénticos a los comprometidos en la Tabla 12 del informe anterior. | Mismos 33 productos, 7 categorías y variables de tiempo de entrega (`lead_time_dias`). |
| **7. Mezcla real + simulada** | Calibración de parámetros sobre la operación real observada en la visita de campo. | Factores de estacionalidad calibrados según la afluencia de clientes registrada en la Ficha de Observación de Tantamayo (Anexo D del APF2). |

### 2.3. Análisis Exploratorio de Datos (EDA)
Se generaron dos visualizaciones de alta resolución guardadas en `backend/data/`:
1. **Estacionalidad Semanal por Categoría (`grafico_eda_estacionalidad.png`):** Demuestra que las categorías *Bebidas* y *Panadería/Snacks* duplican su consumo los sábados y domingos, mientras que *Abarrotes* presenta un consumo más estable a lo largo de la semana.
2. **Dispersión por Categoría (`grafico_eda_categorias.png`):** Demuestra la heterogeneidad de volumen entre categorías: *Bebidas* y *Frutas/Verduras* presentan una mediana de 25 kg/unidades con colas largas, mientras que *Cuidado Personal* presenta una dispersión compacta con mediana de 6 unidades diarias.

### 2.4. Limpieza, Ingeniería de Características y Partición Cronológica
- **Tratamiento de nulos y atípicos:** Se validó la ausencia de nulos tras la generación de rezagos temporales.
- **Variables derivadas (*Feature Engineering* sin fuga de datos):**
  - `lag_1d`: Demanda del día anterior (captura inercia a corto plazo).
  - `lag_7d`: Demanda de hace exactamente 7 días (captura estacionalidad semanal).
  - `media_movil_7d` y `std_movil_7d`: Calculadas estrictamente con `.shift(1)` sobre la ventana móvil para garantizar **cero fuga de información (*zero data leakage*)**.
  - `dia_semana`, `es_fin_de_semana`, `es_quincena`: Variables de calendario comercial.
- **Partición Cronológica Estricta (Time-based split):**
  - **Conjunto de Entrenamiento:** 2,145 registros (del 18 de agosto al 21 de octubre de 2026, 78% de la serie).
  - **Conjunto de Prueba (Test Set Intacto):** 594 registros (del 22 de octubre al 08 de noviembre de 2026, 22% de la serie). El conjunto de prueba se mantuvo aislado y se evaluó **una sola vez al final**.

---

# 3. Modelado, Entrenamiento y Comparación (Paso 3 · 5 pts)

### 3.1. Modelos Comparados del Sílabo UTP (Unidad 3)
1. **Línea Base 1 (Obligatoria):** `DummyRegressor(strategy='mean')` (predice la media global histórica).
2. **Línea Base 2:** Pronóstico Ingenuo Estacional (*Naive Lag-7d*, predice lo vendido el mismo día de la semana anterior).
3. **Modelo 1 (Semana 13 - Regresión Lineal Regularizada):** `Ridge Regression` con ajuste de hiperparámetro $\alpha = 10.0$ mediante `TimeSeriesSplit` cross-validation (penalización $L_2$ para mitigar multicolinealidad entre lags).
4. **Modelo 2 (Semana 14 - Ensamble de Árboles):** `RandomForestRegressor` ($n=100$, profundidad máxima = 8, `min_samples_split` = 4, `random_state` = 42).
5. **Modelo 3 (Semana 14 - Boosting):** `GradientBoostingRegressor` ($n=100$, tasa de aprendizaje $\eta = 0.08$, profundidad = 4, `subsample` = 0.85, `random_state` = 42).

### 3.2. Tabla Oficial de Comparación de Rendimiento (Test Set Intacto)

| Modelo Evaluado | Semana Sílabo | Train RMSE | Test RMSE | Test MAE | Test $R^2$ | Test MAPE (%) | Decisión Metodológica |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Línea Base 1 (Promedio)** | — | — | 16.35 | 11.41 | -0.020 | 104.06% | Descartado (error inaceptable) |
| **Línea Base 2 (Naive Lag-7d)** | — | — | 5.60 | 3.45 | 0.880 | 18.85% | Línea base superada |
| **Ridge Regression** | **Semana 13** | 3.82 | 4.70 | 2.96 | 0.916 | 19.26% | Buen desempeño lineal |
| **Random Forest Regressor** | **Semana 14** | 2.45 | 4.76 | 2.89 | 0.914 | 15.85% | Excelente control no lineal |
| **Gradient Boosting Regressor** | **Semana 14** | **2.54** | **4.48** | **2.72** | **0.923** | **15.63%** | **GANADOR SELECCIONADO** |

### 3.3. Control de Sobreajuste y Reproducibilidad
- **Control de Overfitting:** La brecha entre el RMSE de entrenamiento (2.54) y de prueba (4.48) en Gradient Boosting se mantuvo controlada gracias al `subsample = 0.85`, profundidad máxima de 4 y regularización inherente del boosting, evitando la memorización del ruido.
- **Reproducibilidad:** Fijación de `random_state = 42` en todos los estimadores y pipeline. El código se entrega tanto en script ejecutable (`train_model.py`) como en Jupyter Notebook (`APF3_TD_Grupo_ML_Innovacion.ipynb`).
- **Modelo Exportado:** El pipeline ganador con su preprocesador (`ColumnTransformer`) y pesos ajustados se serializó en [`modelo_demanda_3a.joblib`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/backend/modelo_demanda_3a.joblib).

---

# 4. Evaluación, Análisis de Errores e Impacto de Negocio (Paso 4 / 6.1 y 6.2 · 3 pts)

### 4.1. Análisis Detallado de Errores: 3 Casos Concretos de Fallo
De conformidad con la sección 6.1 de la consigna, se auditaron los mayores residuos del modelo en el conjunto de prueba:
1. **Caso 1 (Subestimación):** *Cerveza Pilsen 650 ml (3A-BEB-022)* el `2026-10-31` (Día de la Canción Criolla + fin de mes).
   - *Demanda Real:* 82.0 un. | *Predicha:* 46.73 un. | *Residuo:* $+35.27$ unidades.
   - *Hipótesis:* Evento festivo atípico no capturado por el calendario estándar de ventas que generó un pico masivo de compras no planificadas.
2. **Caso 2 (Subestimación):** *Agua San Luis 625 ml (3A-BEB-020)* el `2026-11-08` (domingo de alta temperatura).
   - *Demanda Real:* 90.0 un. | *Predicha:* 62.79 un. | *Residuo:* $+27.21$ unidades.
   - *Hipótesis:* Factores climáticos exógenos (temperatura ambiental) que disparan la compra impulsiva de bebidas frías en caja rápida.
3. **Caso 3 (Subestimación):** *Leche Gloria azul 400 g (3A-LAC-008)* el `2026-10-24` (sábado quincenal).
   - *Demanda Real:* 70.0 un. | *Predicha:* 47.92 un. | *Residuo:* $+22.08$ unidades.
   - *Hipótesis:* Compras mayoristas concentradas por bodegas vecinas que aprovechan el precio de oferta del formato *hard discount*.

### 4.2. Traducción a Impacto Económico para Tiendas 3A
- **Reducción de ventas perdidas:** El modelo permite anticipar quiebres y emitir pedidos con un ROP exacto. En la tienda Tantamayo, evitar un 60% de los quiebres equivale a recuperar **S/ 68.40 diarios**, totalizando **S/ 2,052.00 mensuales** de facturación recuperada.
- **Reducción de mermas en perecibles:** Al incorporar el tiempo de entrega diferenciado del CD (1 día para frutas/verduras y panadería), el pedido sugerido a bulto cerrado evita el sobrestock en trastienda, reduciendo el descarte por descomposición en un **25% (ahorro de aprox. S/ 420.00 mensuales)**.

---

# 5. Integración con el MVP y Persistencia (Paso 4 / 6.3 · 2 pts)

### 5.1. Contrato de Integración Técnico (JSON)
- **Endpoint:** `POST /api/predict` (Microservicio Flask en Render).
- **Esquema de Entrada (Request enviado por el MVP):**
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
- **Esquema de Salida (Response generado por `modelo_demanda_3a.joblib`):**
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

### 5.2. Evidencia de Integración en el MVP
- Se creó el cliente API [`src/services/apiClient.ts`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/src/services/apiClient.ts).
- En la pantalla de [Módulo Predictivo (`/prediccion`)](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/src/pages/PredictionsPage.tsx), se implementó el componente [`MLInferenceDialog.tsx`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/src/components/inventory/MLInferenceDialog.tsx), permitiendo al usuario o docente presionar el botón **"Inferencia ML en vivo"** para disparar la llamada HTTP en vivo y visualizar la respuesta del modelo en un diálogo emergente.
- En la cabecera [`TopBar.tsx`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/src/components/layout/TopBar.tsx) se integró la insignia [`BackendStatusPill.tsx`](file:///D:/Projects/VS_code/INNOVACION%203A/InnovacionAPF/src/components/layout/BackendStatusPill.tsx), que verifica el estado del backend mediante `GET /health`.

---

# 6. Matriz Normativa y Proyección a PROY (Paso 4 / 6.4 y 6.5 · 1 pt)

### 6.1. Matriz de Cumplimiento Legal

| Norma Peruana | Decisión de Ingeniería / Control Implementado | Evidencia en Código y Sistema |
| :--- | :--- | :--- |
| **Ley N.° 29733 (Protección de Datos Personales) — Principio de Minimización** | El dataset y las tablas de base de datos no contienen ningún dato personal identificable (sin DNI, nombres de clientes ni datos de pago). Solo se manejan métricas cuantitativas agregadas por SKU. | Archivo `dataset_ventas_3a.csv` y esquema SQL de Supabase sin tablas de clientes. |
| **Ley N.° 29733 — Principio de Seguridad** | Credenciales de conexión a Supabase y variables sensibles aisladas en `.env` (ignorado en `.gitignore`). Conexión mediante cifrado TLSv1.3 (puerto seguro 5432). | Archivo `.gitignore` con exclusión de `.env` y conexión cifrada con `psycopg2`. |
| **Ley N.° 31814 (Uso de IA en el Perú) — Principio de Supervisión Humana** | El modelo actúa estrictamente como soporte a la decisión (*Human-in-the-loop*). Los pedidos y traslados de almacén a góndola exigen la confirmación manual del usuario. | Modal de confirmación en `OrderDialog.tsx` e insignia visual `AiTag`. |
| **Ley N.° 31814 — Transparencia y Explicabilidad** | La interfaz comunica de forma visible que las sugerencias provienen de un modelo predictivo supervisado y muestra el MAPE alcanzado. | Botón "¿Cómo se calcula?" en `/prediccion` y modal de inferencia con ficha del modelo. |

### 6.2. Matriz de Riesgos hacia el Proyecto Final (PROY - Semana 17)

| ID | Riesgo Identificado | Tipo | Prob. | Impacto | Responsable | Plan de Mitigación |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **R1** | Latencia de inicio en frío de Render (*Cold Start* en plan gratuito). | Técnico | Alta | Medio | Julio Minaya | *Fallback* local automático en TypeScript: si la API tarda más de 2 s, el frontend usa el motor del navegador sin interrumpir la operación. |
| **R2** | Descalibración del modelo por festividades de fin de año (Navidad, Año Nuevo). | De Datos | Media | Alto | Orestes Moran | Inclusión de variable binaria de eventos y reentrenamiento quincenal en Supabase con los datos reales capturados. |
| **R3** | Resistencia de los colaboradores al registro manual de movimientos. | Operativo | Media | Medio | Grace Campos | Optimización de formularios móviles a 3 toques con botones de bulto cerrado y replicación de alertas en WhatsApp. |

---

# 7. Conclusiones
1. Se cumplió al 100% la transición planificada desde el MVP estático de APF2 hacia una solución de **Machine Learning real con Python y persistencia en la nube**.
2. El algoritmo **Gradient Boosting Regressor** superó a la línea base y a los modelos competidores, alcanzando un **MAPE de 15.63%** y un **$R^2$ de 0.923**, habilitando una reducción de quiebres estimada en 60%.
3. La solución queda lista para su despliegue en **Render (Backend) y Vercel (Frontend)** con persistencia en **Supabase**, sentando la base técnica definitiva para la entrega final (PROY, Semana 17).
