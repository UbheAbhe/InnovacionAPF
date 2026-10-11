# Inventario Inteligente 3A — Sede Av. Tantamayo

Prototipo de **sistema de gestión de inventario interactivo con alertas de bajo stock y análisis predictivo** para la tienda 3A (AJILES PERU S.A.C.), sucursal Av. Tantamayo 1032, San Martín de Porres.

- 100 % frontend (React 18 + TypeScript + Vite + Tailwind + Recharts).
- Datos simulados en memoria (estado global con `useReducer`); **sin base de datos**.
- Listo para desplegar en **Vercel** como sitio estático.

## Ejecutar en local

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 21 pruebas del motor predictivo y del simulador
npm run build      # typecheck + build de producción en /dist
npm run preview    # sirve /dist
```

Requiere Node 18 o superior.

## Desplegar en Vercel

1. Sube la carpeta a un repositorio de GitHub.
2. En Vercel: **Add New → Project**, importa el repositorio.
3. Vercel detecta Vite automáticamente (`vercel.json` ya define `npm run build`, salida `dist` y la reescritura de rutas a `index.html`).
4. **Deploy**. No se necesitan variables de entorno.

Alternativa por CLI: `npx vercel --prod` dentro de la carpeta.

> Para hosting estático sin reescrituras (GitHub Pages, por ejemplo) compila con `VITE_HASH_ROUTER=true npm run build` y las rutas usarán `#/`.

## Secciones

| Ruta | Sección | Qué incluye |
|---|---|---|
| `/` | Dashboard | KPIs (ventas, productos en riesgo, góndolas vacías/tasa de quiebre, ventas perdidas, pedidos sugeridos, MAPE), semáforo de góndola, dona de riesgo, ventas por categoría, ventas por franja horaria, pronóstico de la tienda, próximos agotamientos |
| `/productos` | Catálogo y stock | Stock de góndola y almacén por separado, semáforo, venta/reposición en un toque, entradas, mermas con motivo, ajustes por conteo, exportación CSV |
| `/prediccion` | Módulo predictivo | Por producto: consumo promedio, tendencia, tiempo para agotarse, fecha de pedido, fecha estimada de reabastecimiento, pedido sugerido en bultos, probabilidad de quiebre y nivel de riesgo. Parámetros del motor editables y pedidos en camino |
| `/analisis` | Análisis | Vista global, por categoría (ej. *Frutas y verduras*) o por producto (ej. *Mandarina*): histórico + pronóstico con banda, proyección de stock vs. punto de reorden, participación (pastel), consumo y cobertura (barras), estacionalidad semanal, franjas horarias, métricas del modelo |
| `/alertas` | Alertas dinámicas | Góndola vacía, reponer góndola, quiebre proyectado, punto de reorden, pedido en camino, sobrestock, demanda al alza. Acciones directas, posponer 15 min y vista previa del mensaje de WhatsApp |
| `/ventas` | Ventas y kardex | Métricas de ventas simuladas, margen, ventas perdidas, cierres diarios, caja rápida, top productos y kardex filtrable/exportable |

La **búsqueda global** (atajo `/`) y los **filtros avanzados** de categoría y riesgo viven en el estado global y se aplican a catálogo, predicción, alertas y kardex.

## Reactividad y simulador

Todo el estado (productos, ventas de hoy, histórico, pedidos, movimientos) está en `src/store`. Las predicciones (`insights`) y las alertas se derivan con `useMemo` del estado, así que **cualquier venta, reposición, merma, ajuste o pedido actualiza al instante gráficos, alertas y predicciones**.

El botón **Simular ventas** avanza un reloj virtual (5 min por segundo a 1×, hasta 4×) y genera ventas de clientes según el perfil por franja horaria. Desde el menú ⚙ se puede avanzar 1 hora, **cerrar el día** (las ventas pasan al histórico, el modelo se reentrena y llegan los pedidos) o activar la reposición automática.

## Motor predictivo (`src/engine`)

| Archivo | Contenido |
|---|---|
| `stats.ts` | Media, desviación, regresión lineal por mínimos cuadrados, EWMA, MAPE, MAE, RMSE, Φ normal |
| `intraday.ts` | Perfil de demanda por franja horaria (picos 12–14 h y 18–21 h) |
| `forecast.ts` | Modelo `demanda(t) = (a + b·t) × índice[día de semana]`, pronóstico con intervalo del 80 %, backtest de 7 días y caché de modelos |
| `inventory.ts` | Métricas por producto: corrección intradía, proyección de stock, tiempo para agotarse, góndola, stock de seguridad, punto de reorden, fecha de pedido, pedido sugerido, reabastecimiento, probabilidad de quiebre y riesgo |
| `alerts.ts` | Generación y priorización de alertas; mensaje con formato WhatsApp |
| `aggregate.ts` | Series y resúmenes por categoría o tienda |

Fórmulas principales:

- **Stock de seguridad:** `SS = z × σ × √L` (z según nivel de servicio 90/95/99 %).
- **Punto de reorden:** `ROP = demanda durante (L + 1 día de revisión) + SS`.
- **Pedido sugerido:** `demanda(L + 1 + días de cobertura) + SS − stock disponible`, redondeado a bultos.
- **Riesgo:** probabilidad de que la demanda supere el stock antes de la próxima reposición posible. Crítico ≥ 50 %, alto ≥ 20 % o pedido requerido hoy, medio ≥ 5 % o pedido en ≤ 2 días.
- **Semáforo de góndola:** rojo ≤ 30 %, ámbar 31–60 %, verde > 60 % de capacidad (o menos de 2/4 horas de cobertura).

## Estructura

```
src/
  domain/types.ts          Modelo de dominio
  data/                    Catálogo (33 SKU, 7 categorías), demanda simulada, histórico de 56 días
  engine/                  Motor estadístico y predictivo (funciones puras + pruebas)
  store/                   Estado global, reducer, simulador y pruebas
  components/
    layout/                Sidebar, barra superior, búsqueda global, navegación móvil
    ui/                    Panel, KPI, badges, modal, toasts…
    charts/                Gráficos (Recharts)
    inventory/             Diálogos de movimiento y pedido, filtros
  pages/                   Las seis secciones
```

## Alcance del prototipo

- Las alertas por WhatsApp se muestran como vista previa (y enlace `wa.me`); no se envían automáticamente.
- El modelo es una regresión lineal con estacionalidad semanal calculada en el navegador; en la arquitectura objetivo del informe se reemplaza por el servicio en Python/scikit-learn.
- Los datos se reinician al recargar la página (estado en memoria, por diseño).
- Las alertas y predicciones indican que son generadas por un modelo; la decisión final es del administrador (Ley N.° 31814).
