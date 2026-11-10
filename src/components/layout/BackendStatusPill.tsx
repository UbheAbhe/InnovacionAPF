import { useEffect, useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { checkBackendHealth, type BackendHealth } from '@/services/apiClient';

export function BackendStatusPill() {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    checkBackendHealth().then((h) => {
      if (mounted) {
        setHealth(h);
        setChecking(false);
      }
    });
    // Reintentar cada 30 segundos
    const interval = setInterval(() => {
      checkBackendHealth().then((h) => {
        if (mounted) setHealth(h);
      });
    }, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (checking) return null;

  return (
    <div
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors md:flex ${
        health?.model_loaded
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border border-gray-200 bg-gray-50 text-gray-600'
      }`}
      title={
        health?.model_loaded
          ? `Backend Python Activo: ${health.model_algorithm} | BD Supabase: ${health.database_connected ? 'Conectada' : 'Offline'}`
          : 'Backend Python desconectado. Operando con motor reactivo local en TypeScript.'
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${
          health?.model_loaded ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
        }`}
        aria-hidden="true"
      />
      <BrainCircuit size={13} className="shrink-0" />
      <span>{health?.model_loaded ? 'ML Backend (Python)' : 'Simulación Local'}</span>
    </div>
  );
}
