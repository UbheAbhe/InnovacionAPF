# Sistema de Gestión de Inventario Inteligente y Predicción de Demanda con ML — Tiendas 3A

> **Proyecto:** Avance de Proyecto Final 3 (APF3)  
> **Curso:** Innovación y Transformación Digital (100000TD09) — UTP  
> **Caso de Estudio:** Tiendas 3A — Sede Av. Tantamayo 1032, San Martín de Porres (AJILES PERU S.A.C., RUC 20612232203)  
> **Repositorio Fork:** [https://github.com/julio060606/InnovacionAPF3](https://github.com/julio060606/InnovacionAPF3)  
> **Repositorio Base:** [https://github.com/UbheAbhe/InnovacionAPF](https://github.com/UbheAbhe/InnovacionAPF)

---

## 📋 Arquitectura General del Sistema

El sistema implementa una arquitectura desacoplada y cloud-native:

```
┌────────────────────────────────┐        HTTP/REST (JSON)        ┌───────────────────────────────────┐
│       Frontend (Vercel)        │ ─────────────────────────────> │       Backend (Render)            │
│  React 18 + TypeScript + Vite  │ <───────────────────────────── │   Flask Microservice + Gunicorn   │
│  Tailwind CSS + Recharts       │   Fallback local automático    │   Python 3.10+ / scikit-learn     │
└────────────────────────────────┘                                └─────────────────┬─────────────────┘
                                                                                    │
                                                                   psycopg2-binary  │  SQL Pool
                                                                   (Port 5432)      │
                                                                                    ▼
                                                                  ┌───────────────────────────────────┐
                                                                  │      Base de Datos (Supabase)     │
                                                                  │      PostgreSQL 15 Relacional     │
                                                                  │      2,970 ventas históricas      │
                                                                  └───────────────────────────────────┘
```

1. **Frontend (Vercel):** Aplicación interactiva de gestión de inventario con semáforo de góndola, alertas dinámicas, control de pedidos, simulador de ventas y modal de inferencia ML en tiempo real.
2. **Backend (Render):** Microservicio en Flask con endpoints REST para health check, inferencia supervisada con scikit-learn, catálogo y kardex.
3. **Machine Learning Pipeline:** Modelo supervisado **Gradient Boosting Regressor** entrenado con 90 días de histórico (2,970 observaciones, 33 SKUs en 7 categorías) con $R^2 = 0.923$ y $MAPE = 15.63\%$, serializado en `modelo_demanda_3a.joblib`.
4. **Persistencia (Supabase):** Base de datos relacional PostgreSQL con DDL normalizado y cumplimiento de la Ley N.° 31814 (etiquetado ético de datos `origen = 'simulado'`).

---

## 🛠️ Tecnologías y Librerías

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, Vitest.
- **Backend & ML:** Python 3.10+, Flask 3.0, Flask-CORS, scikit-learn 1.4+, Pandas, NumPy, psycopg2-binary, joblib, Gunicorn, Matplotlib, Seaborn.
- **Base de Datos & Cloud:** Supabase (PostgreSQL), Render (Web Service), Vercel (Hosting SPA).

---

## 🚀 Guía de Ejecución en Entorno Local

### Requisitos Previos
- **Node.js:** Versión 18.0 o superior (`node -v`).
- **Python:** Versión 3.10 o superior (`python --version`).
- **Git**

---

### 1. Configuración y Ejecución del Backend & ML

Abre una terminal en la raíz del proyecto:

```bash
# 1. Navegar a la carpeta backend
cd backend

# 2. Crear y activar entorno virtual Python
# En Windows:
python -m venv venv
.\venv\Scripts\activate
# En Linux/Mac:
# python3 -m venv venv && source venv/bin/activate

# 3. Instalar dependencias requeridas
pip install -r requirements.txt

# 4. Configurar variables de entorno
# Copiar plantilla .env.example
copy .env.example .env     # En Linux/Mac: cp .env.example .env
```

Configura tu archivo `backend/.env` con la cadena de conexión a Supabase:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:shTEgJDJSqDGpqG5@db.uqkkjfsuvjwyyixcubmt.supabase.co:5432/postgres
```

#### A. Migración de Base de Datos y Poblado (Seeding)
*(Solo necesario si se desea resetear o poblar una nueva base de datos en Supabase)*
```bash
python db/migrate_and_seed.py
```
*Inserta el esquema DDL de 5 tablas y los 2,970 registros de ventas de 90 días con `origen = 'simulado'`.*

#### B. Entrenar el Modelo de Machine Learning
```bash
python train_model.py
```
*Genera:*
- `modelo_demanda_3a.joblib` (pipeline serializado con preprocesamiento y GradientBoostingRegressor).
- `metricas_modelos.json` (comparación con Ridge, Random Forest y DummyRegressor).
- `analisis_errores.json` (análisis de los 3 casos de mayor desviación).
- 4 gráficos de alta resolución en `backend/data/`.

#### C. Iniciar el Servidor Flask API
```bash
python app.py
```
El microservicio quedará escuchando en `http://localhost:5000`.  
Puedes verificar su estado abriendo en tu navegador: `http://localhost:5000/health`.

---

### 2. Configuración y Ejecución del Frontend

Abre **otra terminal** en la raíz del proyecto (`D:\Projects\VS_code\INNOVACION 3A\InnovacionAPF`):

```bash
# 1. Instalar dependencias de Node
npm install

# 2. Configurar variable de entorno para conectar con el backend local (opcional)
# Crea un archivo .env.local en la raíz con:
# VITE_API_URL=http://localhost:5000

# 3. Ejecutar las pruebas unitarias (21 tests)
npm test

# 4. Iniciar servidor de desarrollo Vite
npm run dev
```

La aplicación abrirá en: **`http://localhost:3000`** (o el puerto indicado por Vite).

---

## 🧪 Cómo Probar el Modelo Predictivo

### 1. Desde la Interfaz Web (Frontend)
1. Entra a `http://localhost:3000`.
2. En la barra superior observarás el indicador:
   - 🟢 **ML Backend Activo (Render / Flask)** si el backend está corriendo.
   - 🟡 **Modo Local (Inferencia Fallback)** si el backend está apagado (garantiza resiliencia 100%).
3. Dirígete a la sección **"Predicción"** en el menú lateral.
4. Presiona el botón verde **"Ejecutar Inferencia ML en Vivo"** para abrir el modal interactivo.
5. Selecciona cualquier producto (ej. *Leche Gloria UHT Entera 1 L*), define el stock actual, precio y día de la semana, y pulsa **"Calcular Inferencia con Modelo ML"**.
6. Observarás la predicción de demanda en unidades, probabilidad de quiebre, recomendación de reabastecimiento en bultos y el origen del modelo.

### 2. Vía cURL o Postman (Endpoint `/api/predict`)

```bash
curl -X POST http://localhost:5000/api/predict \
  -H "Content-Type: application/json" \
  -d "{\"sku\": \"3A-FV-001\", \"producto_id\": \"fv-mandarina\", \"precio\": 4.50, \"costo\": 3.10, \"stock_actual\": 12.0, \"pack_size\": 10.0, \"categoria_id\": \"fv\", \"lead_time_dias\": 1, \"lag_1d\": 18.0, \"lag_7d\": 22.0, \"media_movil_7d\": 19.4, \"std_movil_7d\": 2.8, \"dia_semana\": 5, \"es_fin_de_semana\": 1, \"es_quincena\": 1, \"nivel_servicio\": 0.95}"
```

Respuesta JSON esperada:
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
  "timestamp": "2026-11-13T21:45:00.000000"
}
```

---

## ☁️ Guía de Despliegue en la Nube

Para desplegar la solución completa y dejarla en producción:

### Paso 1: Desplegar el Backend en Render (Web Service Gratuito)
1. Inicia sesión en [render.com](https://render.com) vinculando tu cuenta de GitHub.
2. Haz clic en **New + → Web Service**.
3. Selecciona tu repositorio: `julio060606/InnovacionAPF3`.
4. Completa la configuración técnica:
   - **Name:** `tiendas-3a-api` (o el nombre que gustes)
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Plan:** `Free`
5. En la sección **Environment Variables**, añade:
   - `DATABASE_URL` = `postgresql://postgres:shTEgJDJSqDGpqG5@db.uqkkjfsuvjwyyixcubmt.supabase.co:5432/postgres`
   - `PORT` = `10000`
6. Presiona **Create Web Service**. Espera ~2 minutos a que finalice el build y copia la URL generada (ej. `https://tiendas-3a-api.onrender.com`).
7. Prueba en tu navegador: `https://tiendas-3a-api.onrender.com/health`.

### Paso 2: Desplegar el Frontend en Vercel
1. Inicia sesión en [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. Haz clic en **Add New... → Project**.
3. Importa el repositorio `julio060606/InnovacionAPF3`.
4. Configuración del proyecto:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. En **Environment Variables**, añade:
   - `VITE_API_URL` = La URL de Render obtenida en el Paso 1 (ej. `https://tiendas-3a-api.onrender.com` sin barra al final).
6. Haz clic en **Deploy**. En ~45 segundos tu frontend estará en vivo con HTTPS.

---

## 📊 Estructura del Repositorio

```
InnovacionAPF3/
├── backend/
│   ├── data/
│   │   ├── dataset_ventas_3a.csv          # 2,970 registros de ventas históricas
│   │   └── *.png                          # Gráficos EDA, estacionalidad y residuos
│   ├── db/
│   │   ├── schema.sql                     # DDL de PostgreSQL (5 tablas normalizadas)
│   │   └── migrate_and_seed.py            # Script de migración y seeding a Supabase
│   ├── APF3_TD_Grupo_ML_Innovacion.ipynb  # Jupyter Notebook completo de ML
│   ├── app.py                             # Microservicio Flask REST API
│   ├── train_model.py                     # Pipeline de entrenamiento y validación
│   ├── modelo_demanda_3a.joblib           # Modelo exportado Gradient Boosting
│   ├── metricas_modelos.json              # Tabla comparativa de métricas
│   ├── analisis_errores.json              # Casos de fallo documentados
│   ├── requirements.txt                   # Dependencias Python
│   └── .env.example                       # Plantilla de variables de entorno
├── src/
│   ├── components/
│   │   ├── inventory/MLInferenceDialog.tsx # Modal interactivo de inferencia ML
│   │   ├── layout/BackendStatusPill.tsx   # Indicador de estado del backend
│   │   └── ...
│   ├── pages/PredictionsPage.tsx          # Vista de predicciones integrada
│   ├── services/apiClient.ts              # Cliente API REST con fallback resiliente
│   └── ...
├── GUIA_DESPLIEGUE_VERCEL_Y_RENDER.md     # Guía detallada de despliegue paso a paso
├── INFORME_Y_GUIA_APF3_PARA_WORD.md       # Informe técnico completo para Word
└── README.md                              # Documentación principal del proyecto
```

---

## ⚖️ Consideraciones Éticas y Normativas (Ley N.° 31814)

1. **Simulación Explícita de Datos:** Todos los registros históricos en Supabase poseen el atributo `origen = 'simulado'`.
2. **Supervisión Humana Obligatoria (Human-in-the-Loop):** Toda sugerencia de pedido o alerta predictiva requiere confirmación explícita del jefe de tienda antes de generar órdenes de compra.
3. **Resiliencia Operativa:** Si el microservicio en Render no responde o agota su tiempo de espera (timeout 4s), el frontend conmuta automáticamente al motor estadístico local, garantizando continuidad comercial en tienda.
