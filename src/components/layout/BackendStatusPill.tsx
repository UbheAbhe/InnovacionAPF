import { useEffect, useState } from 'react';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { checkBackendHealth, type BackendHealth, API_BASE_URL } from '@/services/apiClient';

export function BackendStatusPill() {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [status, setStatus] = useState<'checking' | 'waking' | 'online' | 'offline'>('checking');

  const checkStatus = async (isManual = false) => {
    if (isManual) setStatus('waking');
    try {
      const h = await checkBackendHealth(isManual ? 20000 : 8000);
      if (h?.model_loaded) {
        setHealth(h);
        setStatus('online');
      } else {
        setHealth(null);
        setStatus('offline');
      }
    } catch {
      setHealth(null);
      setStatus('offline');
    }
  };

  useEffect(() => {
    let mounted = true;
    checkStatus().then(() => {
      if (!mounted) return;
    });

    // Sondeo periódico cada 25 segundos
    const interval = setInterval(() => {
      if (mounted) checkStatus(false);
    }, 25000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => checkStatus(true)}
      className={`hidden cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all md:flex ${
        status === 'online'
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70'
          : status === 'waking'
          ? 'border border-amber-200 bg-amber-50 text-amber-800'
          : 'border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
      }`}
      title={
        status === 'online'
          ? `Backend Python Activo en Render (${health?.model_algorithm}) | Supabase: Conectada`
          : status === 'waking'
          ? 'Despertando el servidor gratuito de Render (cold start ~20-35s). Haz clic para reintentar.'
          : `Servidor en reposo o modo local (${API_BASE_URL}). Haz clic para despertar el backend en Render.`
      }
    >
      {status === 'waking' ? (
        <Loader2 size={13} className="shrink-0 animate-spin text-amber-600" />
      ) : (
        <span
          className={`h-2 w-2 rounded-full ${
            status === 'online'
              ? 'bg-emerald-500 animate-pulse'
              : 'bg-gray-400'
          }`}
          aria-hidden="true"
        />
      )}
      <BrainCircuit size={13} className="shrink-0" />
      <span>
        {status === 'online'
          ? 'ML Backend (Render)'
          : status === 'waking'
          ? 'Despertando Render...'
          : 'Modo Local (Clic para conectar)'}
      </span>
    </button>
  );
}
