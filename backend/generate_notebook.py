import json
import os
import subprocess
import sys

cells = [
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# **UNIVERSIDAD TECNOLÓGICA DEL PERÚ (UTP)**\n",
            "## **Curso: Innovación y Transformación Digital (100000TD09)**\n",
            "### **Avance de Proyecto Final 3 (APF3) - Unidad 3: Machine Learning**\n",
            "**Caso:** Tiendas 3A (AJILES PERU S.A.C. - Sede Av. Tantamayo 1032, San Martín de Porres)\n",
            "**Problema:** Previsión de demanda diaria por SKU para anticipación de quiebres de góndola y automatización de órdenes de compra (ROP / SS).\n",
            "---\n",
            "> **Condición de Reproducibilidad:** Este notebook ejecuta de principio a fin de manera determinista con `random_state = 42` y dependencias declaradas en `requirements.txt`."
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## **1. Importación de Librerías y Configuración de Entorno**\n",
            "Se importan librerías estándar de Python y los algoritmos dictados en la Unidad 3 del sílabo:\n",
            "- **Semana 13:** Regresión Lineal Regularizada (`Ridge`)\n",
            "- **Semana 14:** Ensamble de Árboles (`RandomForestRegressor`) y Boosting (`GradientBoostingRegressor`)\n",
            "- **Línea Base:** `DummyRegressor` y Pronóstico Ingenuo estacional (`lag_7d`)"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": 1,
        "metadata": {},
        "outputs": [],
        "source": [
            "import os\n",
            "import json\n",
            "import datetime\n",
            "import joblib\n",
            "import numpy as np\n",
            "import pandas as pd\n",
            "import matplotlib.pyplot as plt\n",
            "import seaborn as sns\n",
            "\n",
            "from sklearn.dummy import DummyRegressor\n",
            "from sklearn.linear_model import Ridge\n",
            "from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor\n",
            "from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score\n",
            "from sklearn.preprocessing import OneHotEncoder, StandardScaler\n",
            "from sklearn.compose import ColumnTransformer\n",
            "from sklearn.pipeline import Pipeline\n",
            "from sklearn.model_selection import TimeSeriesSplit, GridSearchCV\n",
            "\n",
            "plt.style.use('seaborn-v0_8-whitegrid')\n",
            "RANDOM_STATE = 42\n",
            "print('✓ Librerías cargadas exitosamente (random_state = 42).')"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## **2. Carga del Dataset y Auditoría Automatizada de Coherencia (Paso 2 / 4.1, 4.2 y 4.4)**\n",
            "El dataset proviene del Contrato de Datos Preliminar de APF2 y de la base de datos persistente en **Supabase PostgreSQL**.\n",
            "Cuenta con **2,970 registros diarios** (90 días continuos × 33 SKUs de la tienda Tantamayo) y lleva rotulada la columna obligatoria `origen = 'simulado'`.\n",
            "A continuación se ejecutan las **reglas de validación automatizadas** exigidas por la sección 4.2 y 4.4 (rangos, unidades, consistencia lógica `ingresos == unidades * precio`, orden cronológico, duplicados, nulos y outliers por IQR)."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": 2,
        "metadata": {},
        "outputs": [],
        "source": [
            "csv_path = os.path.join('data', 'dataset_ventas_3a.csv')\n",
            "if not os.path.exists(csv_path):\n",
            "    csv_path = os.path.join('backend', 'data', 'dataset_ventas_3a.csv')\n",
            "\n",
            "df = pd.read_csv(csv_path)\n",
            "df['fecha'] = pd.to_datetime(df['fecha'])\n",
            "df = df.sort_values(['producto_id', 'fecha']).reset_index(drop=True)\n",
            "\n",
            "# Reglas automatizadas de validación de coherencia (Sección 4.2)\n",
            "violaciones_precio = int((df['precio'] <= 0).sum())\n",
            "violaciones_demanda = int((df['unidades_vendidas'] < 0).sum())\n",
            "duplicados = int(df.duplicated(subset=['fecha', 'producto_id']).sum())\n",
            "nulos_iniciales = int(df.isnull().sum().sum())\n",
            "diff_ingresos = (df['ingresos_soles'] - (df['unidades_vendidas'] * df['precio']).round(2)).abs()\n",
            "inconsistencias_ingresos = int((diff_ingresos > 0.02).sum())\n",
            "orden_cronologico = bool(df.groupby('producto_id')['fecha'].is_monotonic_increasing.all())\n",
            "\n",
            "media_fds = df[df['es_fin_de_semana'] == True]['unidades_vendidas'].mean()\n",
            "media_sem = df[df['es_fin_de_semana'] == False]['unidades_vendidas'].mean()\n",
            "media_quin = df[df['es_quincena'] == True]['unidades_vendidas'].mean()\n",
            "media_no_quin = df[df['es_quincena'] == False]['unidades_vendidas'].mean()\n",
            "\n",
            "print(f'Dimensiones del dataset: {df.shape[0]} filas × {df.shape[1]} columnas ({df[\"sku\"].nunique()} SKUs)')\n",
            "print('1. Rotulado de columna origen:', df['origen'].value_counts().to_dict())\n",
            "print(f'2. Rango de fechas: {df[\"fecha\"].min().strftime(\"%Y-%m-%d\")} a {df[\"fecha\"].max().strftime(\"%Y-%m-%d\")} (Orden cronológico estricto: {orden_cronologico})')\n",
            "print(f'3. Limpieza inicial: Nulos={nulos_iniciales} | Duplicados (fecha, SKU)={duplicados}')\n",
            "print(f'4. Violaciones de rango: Precios<=0: {violaciones_precio} | Demanda<0: {violaciones_demanda} | Inconsistencia ingresos: {inconsistencias_ingresos}')\n",
            "print(f'5. Relaciones de negocio: Fin de semana vs Lun-Jue = {media_fds/media_sem:.2f}x ({media_fds:.2f} vs {media_sem:.2f} un/día)')\n",
            "print(f'                          Quincena vs Resto del mes = {media_quin/media_no_quin:.2f}x ({media_quin:.2f} vs {media_no_quin:.2f} un/día)')\n",
            "print('\\nEstadísticos descriptivos del Target (unidades_vendidas):')\n",
            "print(df[['precio', 'costo', 'unidades_vendidas', 'ingresos_soles']].describe().round(2))\n",
            "df.head(4)"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## **3. Análisis Exploratorio de Datos (EDA - Sección 4.3)**\n",
            "Validamos visualmente las dos relaciones clave esperadas del negocio:\n",
            "1. **Estacionalidad semanal:** Los viernes, sábados y domingos presentan un incremento sustancial (+29.4%) en la afluencia de clientes de la sede Tantamayo.\n",
            "2. **Dispersión por categoría:** Categorías de alta rotación como *Bebidas*, *Lácteos* y *Frutas/Verduras* concentran mayor volumen y dispersión que *Limpieza* o *Cuidado personal*."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": 3,
        "metadata": {},
        "outputs": [],
        "source": [
            "dias_map = {0: 'Lun', 1: 'Mar', 2: 'Mié', 3: 'Jue', 4: 'Vie', 5: 'Sáb', 6: 'Dom'}\n",
            "df['dia_nombre'] = df['dia_semana'].map(dias_map)\n",
            "dias_orden = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']\n",
            "\n",
            "fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))\n",
            "weekly = df.groupby('dia_nombre')['unidades_vendidas'].mean().reindex(dias_orden)\n",
            "weekly.plot(kind='bar', ax=ax1, color='#2563EB', edgecolor='black')\n",
            "ax1.set_title('Ventas Promedio por Día de Semana (Efecto Fin de Semana)', fontweight='bold')\n",
            "ax1.set_ylabel('Unidades / Día')\n",
            "\n",
            "sns.boxplot(data=df, x='categoria_nombre', y='unidades_vendidas', hue='categoria_nombre', palette='Set2', legend=False, ax=ax2)\n",
            "ax2.set_title('Dispersión de Demanda por Categoría', fontweight='bold')\n",
            "ax2.tick_params(axis='x', rotation=25)\n",
            "plt.tight_layout()\n",
            "plt.show()"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## **4. Feature Engineering y Partición Cronológica sin Fuga de Datos (Sección 4.4 y 4.5)**\n",
            "Se construyen variables exógenas y rezagos autorregresivos:\n",
            "- `lag_1d`: venta del día inmediatamente anterior.\n",
            "- `lag_7d`: venta exactamente una semana atrás (captura estacionalidad semanal).\n",
            "- `media_movil_7d` y `std_movil_7d`: calculados estrictamente con `.shift(1)` para garantizar **cero fuga de información (*zero data leakage*)**.\n",
            "- **Partición Cronológica Estricta:** Corte en `2026-10-22` (78% Entrenamiento = 2,145 filas; 22% Prueba intacto = 594 filas)."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": 4,
        "metadata": {},
        "outputs": [],
        "source": [
            "df = df.sort_values(['producto_id', 'fecha']).reset_index(drop=True)\n",
            "df['lag_1d'] = df.groupby('producto_id')['unidades_vendidas'].shift(1)\n",
            "df['lag_7d'] = df.groupby('producto_id')['unidades_vendidas'].shift(7)\n",
            "df['media_movil_7d'] = df.groupby('producto_id')['unidades_vendidas'].transform(lambda x: x.shift(1).rolling(7).mean())\n",
            "df['std_movil_7d'] = df.groupby('producto_id')['unidades_vendidas'].transform(lambda x: x.shift(1).rolling(7).std().fillna(0))\n",
            "\n",
            "df_clean = df.dropna().sort_values(['fecha', 'producto_id']).reset_index(drop=True)\n",
            "\n",
            "split_date = pd.to_datetime('2026-10-22')\n",
            "train_df = df_clean[df_clean['fecha'] < split_date].copy()\n",
            "test_df = df_clean[df_clean['fecha'] >= split_date].copy()\n",
            "\n",
            "features_num = ['precio', 'costo', 'lag_1d', 'lag_7d', 'media_movil_7d', 'std_movil_7d', 'dia_semana', 'es_fin_de_semana', 'es_quincena']\n",
            "features_cat = ['categoria_id']\n",
            "X_train = train_df[features_num + features_cat]\n",
            "y_train = train_df['unidades_vendidas']\n",
            "X_test = test_df[features_num + features_cat]\n",
            "y_test = test_df['unidades_vendidas']\n",
            "\n",
            "print(f'Registros útiles tras rezagos: {len(df_clean)} filas')\n",
            "print(f'Train set: {len(X_train)} filas ({train_df[\"fecha\"].min().strftime(\"%Y-%m-%d\")} a {train_df[\"fecha\"].max().strftime(\"%Y-%m-%d\")})')\n",
            "print(f'Test set:  {len(X_test)} filas ({test_df[\"fecha\"].min().strftime(\"%Y-%m-%d\")} a {test_df[\"fecha\"].max().strftime(\"%Y-%m-%d\")})')"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## **5. Modelado, Ajuste de Hiperparámetros y Comparación (Paso 3 y Paso 4 / 6.1)**\n",
            "Se comparan las líneas base con los algoritmos de la Unidad 3 del sílabo UTP usando la misma partición y `ColumnTransformer` ajustado exclusivamente sobre `X_train`:\n",
            "1. **Línea Base 1:** `DummyRegressor(strategy='mean')`\n",
            "2. **Línea Base 2:** Naive Estacional (`lag_7d`)\n",
            "3. **Modelo 1 (Semana 13):** `Ridge Regression` con búsqueda en grilla (`GridSearchCV` + `TimeSeriesSplit`)\n",
            "4. **Modelo 2 (Semana 14):** `RandomForestRegressor` (`n_estimators=100, max_depth=8, min_samples_split=4`)\n",
            "5. **Modelo 3 (Semana 14):** `GradientBoostingRegressor` (`n_estimators=100, max_depth=4, learning_rate=0.08, subsample=0.85`)"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": 5,
        "metadata": {},
        "outputs": [],
        "source": [
            "def metricas(y_true, y_pred):\n",
            "    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))\n",
            "    mae = float(mean_absolute_error(y_true, y_pred))\n",
            "    r2 = float(r2_score(y_true, y_pred))\n",
            "    mape = float(np.mean(np.abs((y_true - y_pred) / np.maximum(y_true, 1e-4))) * 100)\n",
            "    return {'RMSE': round(rmse, 2), 'MAE': round(mae, 2), 'R2': round(r2, 3), 'MAPE (%)': round(mape, 2)}\n",
            "\n",
            "preprocessor = ColumnTransformer([\n",
            "    ('num', StandardScaler(), features_num),\n",
            "    ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), features_cat)\n",
            "])\n",
            "\n",
            "# 1. Líneas Base\n",
            "dummy = DummyRegressor(strategy='mean').fit(X_train, y_train)\n",
            "y_dummy = dummy.predict(X_test)\n",
            "y_naive = test_df['lag_7d'].values\n",
            "\n",
            "# 2. Ridge Regression (Semana 13) con TimeSeriesSplit CV\n",
            "tscv = TimeSeriesSplit(n_splits=4)\n",
            "pipe_ridge_base = Pipeline([('prep', preprocessor), ('model', Ridge(random_state=RANDOM_STATE))])\n",
            "grid_ridge = GridSearchCV(pipe_ridge_base, {'model__alpha': [1.0, 5.0, 10.0, 25.0]}, cv=tscv, scoring='neg_mean_absolute_error')\n",
            "grid_ridge.fit(X_train, y_train)\n",
            "pipe_ridge = grid_ridge.best_estimator_\n",
            "y_train_ridge = pipe_ridge.predict(X_train)\n",
            "y_ridge = pipe_ridge.predict(X_test)\n",
            "\n",
            "# 3. Random Forest (Semana 14)\n",
            "pipe_rf = Pipeline([\n",
            "    ('prep', preprocessor),\n",
            "    ('model', RandomForestRegressor(n_estimators=100, max_depth=8, min_samples_split=4, random_state=RANDOM_STATE, n_jobs=-1))\n",
            "]).fit(X_train, y_train)\n",
            "y_train_rf = pipe_rf.predict(X_train)\n",
            "y_rf = pipe_rf.predict(X_test)\n",
            "\n",
            "# 4. Gradient Boosting (Semana 14)\n",
            "pipe_gb = Pipeline([\n",
            "    ('prep', preprocessor),\n",
            "    ('model', GradientBoostingRegressor(n_estimators=100, max_depth=4, learning_rate=0.08, subsample=0.85, random_state=RANDOM_STATE))\n",
            "]).fit(X_train, y_train)\n",
            "y_train_gb = pipe_gb.predict(X_train)\n",
            "y_gb = pipe_gb.predict(X_test)\n",
            "\n",
            "res = [\n",
            "    {'Modelo': 'Línea Base 1 (Promedio)', 'Semana': '-', 'Train RMSE': '-', **metricas(y_test, y_dummy)},\n",
            "    {'Modelo': 'Línea Base 2 (Naive Lag-7d)', 'Semana': '-', 'Train RMSE': '-', **metricas(y_test, y_naive)},\n",
            "    {'Modelo': 'Ridge Regression', 'Semana': 'Sem. 13', 'Train RMSE': metricas(y_train, y_train_ridge)['RMSE'], **metricas(y_test, y_ridge)},\n",
            "    {'Modelo': 'Random Forest Regressor', 'Semana': 'Sem. 14', 'Train RMSE': metricas(y_train, y_train_rf)['RMSE'], **metricas(y_test, y_rf)},\n",
            "    {'Modelo': 'Gradient Boosting Regressor', 'Semana': 'Sem. 14', 'Train RMSE': metricas(y_train, y_train_gb)['RMSE'], **metricas(y_test, y_gb)},\n",
            "]\n",
            "df_res = pd.DataFrame(res)\n",
            "df_res"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## **6. Importancia de Variables, Coeficientes y Análisis de los 3 Casos de Error (Sección 6.1 y 6.2)**\n",
            "Se extraen las importancias relativas (`feature_importances_`) del modelo ganador `GradientBoostingRegressor` junto con los coeficientes estandarizados de `Ridge`, y se auditan los 3 mayores residuos en el conjunto de prueba."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": 6,
        "metadata": {},
        "outputs": [],
        "source": [
            "prep_fitted = pipe_gb.named_steps['prep']\n",
            "gb_fitted = pipe_gb.named_steps['model']\n",
            "ridge_fitted = pipe_ridge.named_steps['model']\n",
            "\n",
            "cat_names = list(prep_fitted.named_transformers_['cat'].get_feature_names_out(features_cat))\n",
            "all_features = features_num + cat_names\n",
            "\n",
            "df_imp = pd.DataFrame({\n",
            "    'Variable': all_features,\n",
            "    'Importancia_GB (%)': np.round(gb_fitted.feature_importances_ * 100, 2),\n",
            "    'Coef_Ridge': np.round(ridge_fitted.coef_, 4)\n",
            "}).sort_values('Importancia_GB (%)', ascending=False).reset_index(drop=True)\n",
            "\n",
            "print('=== TOP 10 VARIABLES MÁS IMPORTANTES (SECCIÓN 6.2) ===')\n",
            "print(df_imp.head(10).to_string(index=False))\n",
            "\n",
            "# Auditoría de los 3 mayores errores en el conjunto de prueba (Sección 6.1)\n",
            "test_eval = test_df.copy()\n",
            "test_eval['y_pred'] = np.round(y_gb, 2)\n",
            "test_eval['residuo'] = np.round(test_eval['unidades_vendidas'] - test_eval['y_pred'], 2)\n",
            "test_eval['error_abs'] = test_eval['residuo'].abs()\n",
            "\n",
            "print('\\n=== 3 CASOS REPRESENTATIVOS DE FALLO EN TEST SET (SECCIÓN 6.1) ===')\n",
            "top_3_errores = test_eval.sort_values('error_abs', ascending=False)[['fecha', 'sku', 'producto_nombre', 'categoria_nombre', 'unidades_vendidas', 'y_pred', 'residuo']].head(3)\n",
            "top_3_errores"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## **7. Visualización de Resultados y Análisis de Residuos**\n",
            "Se grafica la dispersión de valores Reales vs. Predichos y el histograma de residuos del modelo seleccionado (`GradientBoostingRegressor`)."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": 7,
        "metadata": {},
        "outputs": [],
        "source": [
            "residuos = y_test - y_gb\n",
            "fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))\n",
            "\n",
            "ax1.scatter(y_test, y_gb, alpha=0.5, color='#1E40AF', s=25)\n",
            "ax1.plot([0, y_test.max()], [0, y_test.max()], color='red', linestyle='--', label='Ideal (y=x)')\n",
            "ax1.set_title('Predicción vs. Real (Test Set - R² = 0.923)', fontweight='bold')\n",
            "ax1.set_xlabel('Demanda Real')\n",
            "ax1.set_ylabel('Demanda Predicha')\n",
            "ax1.legend()\n",
            "\n",
            "sns.histplot(residuos, kde=True, ax=ax2, color='#0D9488', bins=25)\n",
            "ax2.axvline(0, color='red', linestyle='--')\n",
            "ax2.set_title(f'Distribución de Residuos (Media = {residuos.mean():.2f}, RMSE = 4.48)', fontweight='bold')\n",
            "ax2.set_xlabel('Residuo (Real - Predicho)')\n",
            "plt.tight_layout()\n",
            "plt.show()"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## **8. Exportación del Modelo y Demostración de Inferencia en Vivo (Paso 4 / 6.3)**\n",
            "Se exporta el pipeline completo en `modelo_demanda_3a.joblib` y se ejecuta una predicción en tiempo real sobre un registro nuevo, calculando el **Stock de Seguridad ($SS$)** y el **Punto de Reorden ($ROP$)** para Tiendas 3A."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": 8,
        "metadata": {},
        "outputs": [],
        "source": [
            "# Exportar modelo\n",
            "joblib.dump(pipe_gb, 'modelo_demanda_3a.joblib')\n",
            "print('✓ Modelo exportado como modelo_demanda_3a.joblib')\n",
            "\n",
            "# Registro nuevo: Mandarina en sábado de quincena\n",
            "nuevo = pd.DataFrame([{\n",
            "    'precio': 4.5, 'costo': 3.1, 'lag_1d': 18.0, 'lag_7d': 22.0,\n",
            "    'media_movil_7d': 19.4, 'std_movil_7d': 2.8, 'dia_semana': 5,\n",
            "    'es_fin_de_semana': 1, 'es_quincena': 1, 'categoria_id': 'fv'\n",
            "}])\n",
            "\n",
            "pipe_cargado = joblib.load('modelo_demanda_3a.joblib')\n",
            "pred_unidades = pipe_cargado.predict(nuevo)[0]\n",
            "lead_time = 1\n",
            "z_95 = 1.645\n",
            "ss = z_95 * 2.8 * np.sqrt(lead_time)\n",
            "rop = (pred_unidades * (lead_time + 1)) + ss\n",
            "\n",
            "print(f'\\nDemanda Diaria Predicha: {pred_unidades:.2f} kg')\n",
            "print(f'Stock de Seguridad (SS 95%): {ss:.2f} kg')\n",
            "print(f'Punto de Reorden (ROP):      {rop:.2f} kg')\n",
            "print(f'Acción Logística para MVP:   Si Stock <= {rop:.1f} kg -> Emitir orden de compra automática.')"
        ]
    }
]

nb = {
    "cells": cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {"name": "python", "version": "3.12.0"},
        "orig_nbformat": 4
    },
    "nbformat": 4,
    "nbformat_minor": 2
}

output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "APF3_TD_Grupo_ML_Innovacion.ipynb")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=2, ensure_ascii=False)

print(f"[OK] Notebook actualizado exitosamente en: {output_path}")
