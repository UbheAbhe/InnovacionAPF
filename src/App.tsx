import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { ActionsProvider } from '@/components/inventory/ActionsProvider';
import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { StoreProvider } from '@/store/StoreProvider';
import DashboardPage from '@/pages/DashboardPage';

// Las secciones secundarias se cargan bajo demanda para aligerar la primera carga.
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const PredictionsPage = lazy(() => import('@/pages/PredictionsPage'));
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const SalesPage = lazy(() => import('@/pages/SalesPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// En Vercel se usa BrowserRouter (vercel.json reescribe las rutas). VITE_HASH_ROUTER=true para hosting estático sin rewrites.
const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <StoreProvider>
        <ToastProvider>
          <ActionsProvider>
            <AppShell>
              <Suspense fallback={<div className="py-20 text-center text-sm text-muted">Cargando…</div>}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/productos" element={<ProductsPage />} />
                  <Route path="/prediccion" element={<PredictionsPage />} />
                  <Route path="/analisis" element={<AnalysisPage />} />
                  <Route path="/alertas" element={<AlertsPage />} />
                  <Route path="/ventas" element={<SalesPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AppShell>
          </ActionsProvider>
        </ToastProvider>
      </StoreProvider>
    </Router>
  );
}
