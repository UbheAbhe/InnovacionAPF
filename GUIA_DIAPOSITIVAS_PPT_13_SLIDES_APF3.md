# GUÍA OFICIAL PARA LA PRESENTACIÓN EN PPT (APF3)
## Estructura Exacta de 13 Diapositivas para la Sustentación (12 min + 5 min de preguntas)
**Curso:** Innovación y Transformación Digital (100000TD09) — UTP | 2026-2  
**Caso:** Tiendas 3A — Sede Av. Tantamayo 1032, San Martín de Porres (AJILES PERU S.A.C., RUC 20612232203)  
**Equipo:** Orestes Moran, Grace Campos, Julio Minaya, Jardiel Damian  

---

> [!IMPORTANT]
> **Regla de Oro de la Consigna (Sección 9):**  
> Máximo **13 diapositivas**. La exposición grupal debe durar **12 minutos** (todos los integrantes deben exponer y responder). Excederse de 13 minutos penaliza la nota.

---

### ⏱️ Cronograma de Exposición por Bloque (12 Minutos)

| Bloque | Slides | Tiempo | Quién Expone (Sugerencia) |
|---|:---:|:---:|---|
| **Bloque 1: Problema ML y Recapitulación** | 1 y 2 | 1.0 min | Integrante 1 (Orestes) |
| **Bloque 2: Dataset, Coherencia y EDA** | 3 y 4 | 2.5 min | Integrante 2 (Grace) |
| **Bloque 3: Modelado de U3 y Optimización** | 5 y 6 | 2.5 min | Integrante 3 (Jardiel) |
| **Bloque 4: Métricas, Errores y DEMO EN VIVO** | 7, 8 y 9 | 2.5 min | Integrante 4 (Julio) |
| **Bloque 5: Impacto Económico e Integración MVP** | 10 y 11 | 2.0 min | Integrante 1 & 2 (Orestes / Grace) |
| **Bloque 6: Leyes, Riesgos y Conclusiones** | 12 y 13 | 1.5 min | Integrante 3 & 4 (Jardiel / Julio) |
| **Ronda de Preguntas del Docente** | — | 5.0 min | Todo el equipo |

---

## 🖥️ Contenido Detallado Slide por Slide

### Slide 1: Carátula Institucional
* **Título:** Solución de Machine Learning para la MiPYME: Sistema de Inventario Inteligente y Predicción de Demanda Diaria por SKU en Tiendas 3A (Sede Av. Tantamayo 1032, SMP).
* **Datos:** UTP — Facultad de Ingeniería — Curso: Innovación y Transformación Digital.
* **Integrantes:** Moran Orestes, Campos Grace, Minaya Julio, Damian Jardiel.
* **Docente:** Mg. Richard Enrique Caman Sanchez.
* **Enlaces:** Repositorio GitHub (`julio060606/InnovacionAPF3`) y Web en Vercel.

---

### Slide 2: Recapitulación APF1/APF2 y Problema de Machine Learning
* **Contexto Tiendas 3A:** Formato *hard discount*, 33 SKUs esenciales, 7 categorías, cajas SRP.
* **Diagnóstico (APF1):** Quiebre de góndola del 14.2% en horas punta (17:00–21:00 h). MAPE empírico de 28.5%. Pérdida de S/ 114.00 diarios.
* **Tipificación:** Aprendizaje Supervisado de **Regresión de valor continuo de series temporales** con variables exógenas.
* **Target:** `unidades_vendidas` (unidades o kg/día por SKU).
* **Frase Reglamentaria:**  
  > *"Para el Administrador de Tiendas 3A, el modelo predecirá la demanda diaria por SKU con el propósito de anticipar quiebres y determinar el Punto de Reorden (ROP), medido con un MAPE &le; 16.0% para reducir quiebres en 60%."*

---

### Slide 3: Dataset Oficial y Trazabilidad (Supabase Cloud)
* **Volumen:** 2,970 registros diarios (90 días continuos &times; 33 SKUs, del 11-ago al 08-nov de 2026).
* **Rotulado Ético (Sec. 4.1):** 100% rotulado con `origen = 'simulado'`.
* **Persistencia:** Base de datos PostgreSQL alojada en **Supabase** (`tabla historial_ventas`).
* **Trazabilidad con APF2:** Mismos 33 SKUs, 7 familias y lead times de la Tabla 12 del informe anterior.

---

### Slide 4: Ficha de Coherencia de Datos y EDA
* **Verificación de 7 Criterios:** 0 precios negativos, 0 demandas negativas, consistencia exacta `ingresos == unidades * precio`, orden temporal estricto.
* **Patrones del Retail Peruano:**
  - Fin de semana vs. días de semana: **+29.4%** (de 15.72 a 20.33 un/día).
  - Quincenas vs. resto: **+14.5%** (de 17.32 a 19.84 un/día).
* **Imágenes a insertar:**
  - `grafico_eda_estacionalidad.png` (Figura 1: curva de lunes a domingo).
  - `grafico_eda_categorias.png` (Figura 2: boxplot de dispersión por categoría).

---

### Slide 5: Modelado de Unidad 3 y Metodología
* **Partición Cronológica Estricta (Zero Data Leakage):**
  - Train: 2,145 registros (78.3%, 18-ago al 21-oct).
  - Test Intacto: 594 registros (21.7%, 22-oct al 08-nov).
* **Modelos Evaluados del Sílabo:**
  1. *DummyRegressor* (Línea base promedio).
  2. *Naive Lag-7d* (Línea base estacional de tienda).
  3. *Ridge Regression* (Semana 13 - Regresión Lineal Regularizada L2).
  4. *RandomForestRegressor* (Semana 14 - Ensamble Bagging).
  5. *GradientBoostingRegressor* (Semana 14 - Boosting Secuencial).

---

### Slide 6: Optimización de Hiperparámetros y Control de Overfitting
* **Validación Cruzada:** `TimeSeriesSplit(n_splits=4)` con `GridSearchCV` solo en Train.
* **Configuración Óptima del Ganador (Gradient Boosting):**
  - `n_estimators = 100`, `max_depth = 4`, `learning_rate = 0.08`, `subsample = 0.85`, `random_state = 42`.
* **Control de Sobreajuste:** Árboles poco profundos y submuestreo estocástico controlan la brecha: Train RMSE (2.54) vs. Test RMSE (4.48).
* **Pipeline Exportado:** Serializado en `modelo_demanda_3a.joblib` (253 KB).

---

### Slide 7: Tabla Oficial de Rendimiento en Test Set
* **Insertar Tabla Oficial:**
  | Modelo | Semana Sílabo | Test RMSE | Test MAE | Test R² | Test MAPE (%) |
  |---|:---:|:---:|:---:|:---:|:---:|
  | DummyRegressor (Media) | — | 16.35 | 11.41 | -0.020 | 104.06% |
  | Naive Lag-7d (Estacional) | — | 5.60 | 3.45 | 0.880 | 18.85% |
  | Ridge Regression | Sem. 13 | 4.70 | 2.96 | 0.916 | 19.26% |
  | Random Forest Regressor | Sem. 14 | 4.76 | 2.89 | 0.914 | 15.85% |
  | **Gradient Boosting** | **Sem. 14** | **4.48** | **2.72** | **0.923** | **15.63% (GANADOR)** |
* **Hito de Negocio:** Superó la meta de MAPE &le; 16.0% fijada en el Paso 1.

---

### Slide 8: Análisis Gráfico y 3 Casos Concretos de Fallo
* **Imágenes a insertar:**
  - `grafico_prediccion_vs_real.png` (Figura 3: R² = 0.923).
  - `grafico_residuos.png` (Figura 4: histograma centrado en -0.08).
* **Los 3 Casos de Fallo:**
  1. *Cerveza Pilsen (+35.2 un):* Día de la Canción Criolla + fin de mes (evento festivo no capturado por el calendario normal).
  2. *Agua San Luis (+27.2 un):* Domingo de ola de calor (falta predictor de temperatura).
  3. *Leche Gloria (+22.1 un):* Compras mayoristas de bodegas vecinas en fin de semana.

---

### Slide 9: DEMOSTRACIÓN EN VIVO (Ejecución Real del Modelo)
* **Punto de Inflexión de la Exposición (1.5 min):**
  - Abrir la web en Vercel: ir a `/prediccion`.
  - Mostrar la pastilla verde: 🟢 **ML Backend (Render)**.
  - Abrir el modal: **"Inferencia ML en vivo"**.
  - Usar el nuevo menú desplegable para elegir un producto (ej. *Leche Gloria* o *Agua San Luis*) y darle a **"Recalcular"**.
  - Mostrar cómo responde la API en Python calculando la Demanda Diaria, Stock de Seguridad (SS), Punto de Reorden (ROP) y el pedido sugerido en bultos.

---

### Slide 10: Impacto Económico e Importancia de Variables
* **Impacto Mensual Cuantificado para Tiendas 3A:**
  - Ventas recuperadas (60% menos quiebres): **+S/ 2,052.00 / mes**.
  - Ahorro en mermas de frutas y panadería: **+S/ 420.00 / mes**.
  - Total beneficio mensual: **S/ 2,472.00 / mes** y 20 horas operativas liberadas.
* **Importancia de Variables (Figura 5 `grafico_importancia_variables.png`):**
  - `lag_7d` (47.6%) y `media_movil_7d` (45.1%) explican el 92.7% de la demanda en San Martín de Porres.

---

### Slide 11: Integración Técnica con el MVP (Contrato JSON)
* **Arquitectura de Integración:**  
  `Frontend React (Vercel)` &harr; `Microservicio Flask (Render)` &harr; `Supabase PostgreSQL`.
* **Contrato JSON:** Mostrar brevemente el snippet de Request y Response.
* **Resiliencia Operativa:** Fallback automático al motor local de TypeScript ante desconexión o cold-start de Render.

---

### Slide 12: Cumplimiento Normativo Peruano
* **Ley N.° 29733 (Protección de Datos Personales):**
  - Principio de Minimización: 0 datos personales en el dataset (sin DNI ni nombres de clientes).
  - Anonimización en Kardex ('Colaborador 3A') y variables `.env` protegidas.
* **Ley N.° 31814 (Uso de Inteligencia Artificial en el Perú):**
  - Supervisión Humana obligatoria (*Human-in-the-Loop*): el modelo sugiere órdenes, el jefe de tienda confirma.
  - Transparencia: etiqueta IA visible y MAPE declarado en pantalla.

---

### Slide 13: Matriz de Riesgos y Proyección al Proyecto Final (PROY)
* **3 Riesgos Gestionados:**
  - *R1 (Técnico):* Cold-start en Render &rarr; Mitigado con botón de despertado y fallback local.
  - *R2 (Datos):* Descalibración en fiestas de fin de año &rarr; Variable `es_feriado` para PROY.
  - *R3 (Operativo):* Resistencia al registro &rarr; Interfaz móvil ágil a 2 toques.
* **Conclusión Final:** De un prototipo estático en APF2 a una solución de Machine Learning real, validada y desplegada en la nube para la toma de decisiones en Tiendas 3A.
