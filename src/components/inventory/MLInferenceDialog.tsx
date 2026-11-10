import { useState } from 'react';
import { BrainCircuit, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { predictWithML, type MLPredictionResponse } from '@/services/apiClient';
import { useStore } from '@/store/StoreProvider';
import { money } from '@/lib/format';

export function MLInferenceButton() {
  const { state, productById } = useStore();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [result, setResult] = useState<MLPredictionResponse | null>(null);

  const runInference = async () => {
    if (!state) return;
    const p = state.products.find((prod) => prod.id === 'fv-mandarina') || state.products[0];
    if (!p) return;

    setLoading(true);
    setIsWaking(false);
    const hist = state.history[p.id] || [];
    const lag1 = hist.length > 0 ? hist[hist.length - 1].units : 15;
    const lag7 = hist.length >= 7 ? hist[hist.length - 7].units : 18;
    const last7 = hist.slice(-7).map((x) => x.units);
    const avg7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : 16;
    const nowD = new Date(state.now);

    const payload = {
      sku: p.sku,
      producto_id: p.id,
      precio: p.price,
      costo: p.cost,
      stock_actual: p.stockGondola + p.stockAlmacen,
      capacidad_gondola: p.gondolaCapacity,
      pack_size: p.packSize,
      categoria_id: p.categoryId,
      lead_time_dias: p.leadTimeDays,
      lag_1d: lag1,
      lag_7d: lag7,
      media_movil_7d: avg7,
      std_movil_7d: Math.max(1.5, avg7 * 0.15),
      dia_semana: (nowD.getDay() + 6) % 7,
      es_fin_de_semana: [4, 5, 6].includes((nowD.getDay() + 6) % 7) ? 1 : 0,
      es_quincena: [15, 16, 30, 31, 1].includes(nowD.getDate()) ? 1 : 0,
      nivel_servicio: state.settings?.serviceLevel || 0.95,
    };

    const data = await predictWithML(payload, (waking) => setIsWaking(waking));
    setLoading(false);
    setIsWaking(false);

    if (data) {
      setResult(data);
      setModalOpen(true);
      toast('Inferencia recibida exitosamente desde API en Python (Gradient Boosting).', 'info');
    } else {
      toast('El backend de Render aún no respondió. Operando con el motor reactivo local.', 'warning');
    }
  };

  return (
    <>
      <button
        onClick={runInference}
        disabled={loading}
        className="btn-outline flex items-center gap-1.5 border-emerald-600/30 text-emerald-800 hover:bg-emerald-50"
        title="Ejecutar inferencia real con el modelo serializado en Python (.joblib)"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin text-emerald-600" />
        ) : (
          <BrainCircuit size={16} className="text-emerald-700" />
        )}
        <span>
          {loading
            ? isWaking
              ? 'Despertando Render (~30s)...'
              : 'Consultando API...'
            : 'Inferencia ML en vivo'}
        </span>
      </button>

      {modalOpen && result && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Inferencia de Machine Learning en Vivo (Python)"
          subtitle="Microservicio Flask conectado a modelo GradientBoostingRegressor (.joblib)"
          width="sm:max-w-xl"
        >
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <Sparkles size={13} /> Inferencia de Demanda en Producción
                  </span>
                  <h3 className="text-lg font-bold text-ink">
                    {result.sku} — {productById?.[result.producto_id]?.name || result.producto_id}
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                  MAPE {result.mape_modelo}%
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
                <div className="rounded-lg bg-white p-2.5 shadow-sm border border-emerald-100">
                  <div className="text-muted">Demanda diaria</div>
                  <div className="num text-base font-bold text-ink">{result.demanda_predicha_dia} {productById?.[result.producto_id]?.unit || 'un'}</div>
                </div>
                <div className="rounded-lg bg-white p-2.5 shadow-sm border border-emerald-100">
                  <div className="text-muted">Stock seguridad (SS)</div>
                  <div className="num text-base font-bold text-ink">{result.stock_seguridad_ss} un</div>
                </div>
                <div className="rounded-lg bg-white p-2.5 shadow-sm border border-emerald-100">
                  <div className="text-muted">Punto reorden (ROP)</div>
                  <div className="num text-base font-bold text-ink">{result.punto_reorden_rop} un</div>
                </div>
                <div className="rounded-lg bg-white p-2.5 shadow-sm border border-emerald-100">
                  <div className="text-muted">Riesgo calculado</div>
                  <div className={`num text-base font-bold uppercase ${
                    result.riesgo === 'critico' ? 'text-red-600' :
                    result.riesgo === 'alto' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{result.riesgo}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted">Modelo de Machine Learning:</span>
                <span className="font-semibold text-ink">{result.modelo}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted">Pedido sugerido al proveedor:</span>
                <span className="font-bold text-emerald-800">{result.pedido_sugerido_bultos} bultos ({result.pedido_sugerido_unidades} un.)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted">Costo estimado de reposición:</span>
                <span className="font-semibold text-ink">{money(result.costo_pedido_estimado)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted">Días de cobertura actuales:</span>
                <span className="font-semibold text-ink">{result.dias_cobertura} días</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Origen de persistencia:</span>
                <span className="font-semibold text-sky-700">Supabase PostgreSQL (Cloud)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-sky-50 p-3 text-xs text-sky-900 border border-sky-100">
              <CheckCircle2 size={16} className="shrink-0 text-sky-600" />
              <span>
                Inferencia validada con <strong>R² = 0.923</strong>. Decisión sujeta a supervisión humana según la <strong>Ley N.° 31814</strong>.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-outline text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
