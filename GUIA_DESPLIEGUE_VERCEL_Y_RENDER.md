# GUÍA PASO A PASO: DESPLIEGUE EN RENDER Y VERCEL
## Sistema de Inventario Inteligente Tiendas 3A (UTP - APF3)

Esta guía explica cómo desplegar el proyecto completo en la nube utilizando las cuentas gratuitas de **Render** (para la API en Python y Machine Learning) y **Vercel** (para la aplicación web en React).

---

### Paso 1: Subir los cambios a GitHub

Desde la carpeta raíz del proyecto (`InnovacionAPF`), abre la terminal y ejecuta:

```bash
git add .
git commit -m "feat(apf3): modelo Machine Learning Gradient Boosting, API Flask y persistencia Supabase"
git push origin master
```

*(El archivo `.gitignore` ya está configurado para que la contraseña de Supabase no se suba a GitHub, garantizando la seguridad exigida por la Ley N.° 29733).*

---

### Paso 2: Desplegar el Backend en Render (Python + Scikit-Learn)

1. Ve a [dashboard.render.com](https://dashboard.render.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en el botón superior **New +** y selecciona **Web Service**.
3. Selecciona tu repositorio: `InnovacionAPF` (o `UbheAbhe/InnovacionAPF`).
4. Configura los siguientes campos:
   - **Name:** `tiendas3a-api` (o el nombre que gustes).
   - **Region:** Ohio (US East) u Oregon.
   - **Branch:** `master` (o `main`).
   - **Root Directory:** `backend` *(¡MUY IMPORTANTE!: escribir `backend` para que Render busque dentro de esa carpeta)*.
   - **Runtime:** `Python 3`.
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python app.py`
   - **Instance Type:** `Free`.
5. En la sección inferior **Environment Variables**, haz clic en **Add Environment Variable** y agrega:
   - **Key:** `DATABASE_URL`
   - **Value:** `postgresql://postgres:shTEgJDJSqDGpqG5@db.uqkkjfsuvjwyyixcubmt.supabase.co:5432/postgres`
6. Haz clic en el botón inferior **Deploy Web Service**.
7. En unos 2 minutos, Render compilará las dependencias y verás en verde el mensaje `Live`.
8. **Copia la URL pública** que te genera Render en la parte superior (ejemplo: `https://tiendas3a-api.onrender.com`).

---

### Paso 3: Desplegar / Actualizar el Frontend en Vercel (React + Vite)

1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard).
2. Si el proyecto ya existe en tu Vercel:
   - Ve a tu proyecto -> Pestaña **Settings** -> **Environment Variables**.
   - Agrega la variable:
     - **Key:** `VITE_API_URL`
     - **Value:** La URL de Render que copiaste en el paso anterior (ejemplo: `https://tiendas3a-api.onrender.com`).
   - Ve a la pestaña **Deployments**, haz clic en los tres puntos del último commit y selecciona **Redeploy**.
3. Si lo estás importando por primera vez en Vercel:
   - Haz clic en **Add New...** -> **Project** e importa `InnovacionAPF`.
   - **Framework Preset:** Vite.
   - **Root Directory:** `./` (la raíz del repositorio).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - En **Environment Variables**, agrega:
     - `VITE_API_URL`: `https://tiendas3a-api.onrender.com` (tu URL de Render).
   - Haz clic en **Deploy**.

---

### Paso 4: Cómo verificar que todo está conectado en producción

1. Abre la URL pública de tu aplicación en Vercel (en tu laptop o en tu celular).
2. En la barra superior verás la insignia interactiva:
   - Si la API de Render está despierta: `🟢 ML Backend (Python)`.
   - Si Render está en frío o desconectado: `⚪ Simulación Local`.
3. Ve a la sección **/prediccion** del menú y haz clic en el botón verde **"Inferencia ML en vivo"**:
   - Se abrirá un modal mostrando la respuesta directa del modelo `GradientBoostingRegressor`, el MAPE del 15.63%, la demanda predicha y el cálculo del ROP / Stock de Seguridad.
4. Entra a tu panel de [Supabase Table Editor](https://supabase.com/dashboard/project/uqkkjfsuvjwyyixcubmt/editor) para ver las 5 tablas creadas y los registros de ventas y Kardex persistentes.

---

### ¿Qué pasa si la instancia gratuita de Render está "durmiendo"?
En el plan gratuito, Render entra en modo de reposo tras 15 minutos sin visitas y tarda unos 30 segundos en reactivarse. **El frontend tiene un fallback inteligente:** si Render tarda más de 2 segundos en responder, la interfaz conmuta de forma transparente al motor local en TypeScript. **Tu aplicación nunca se quedará congelada ni mostrará un error en pantalla.**
