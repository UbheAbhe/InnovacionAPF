import { CalendarClock, FastForward, Pause, Play, RotateCcw, Settings2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { isStoreOpen } from '@/engine/intraday';
import { formatDayShort, toDateKey } from '@/lib/dates';
import { useStore } from '@/store/StoreProvider';

export function VirtualClock({ compact = false }: { compact?: boolean }) {
  const { state } = useStore();
  const d = new Date(state.now);
  const open = isStoreOpen(d);
  const time = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="flex items-center gap-2" title="Reloj virtual de la tienda">
      <span className={`h-2 w-2 shrink-0 rounded-full ${open ? 'bg-risk-bajo' : 'bg-faint'} ${state.simulator.running ? 'animate-pulse' : ''}`} aria-hidden />
      <div className="leading-tight">
        <div className="num text-sm font-bold text-ink">
          {compact ? '' : `${formatDayShort(toDateKey(d))} · `}
          {time}
        </div>
        {!compact && <div className="text-[11px] text-muted">{open ? 'Tienda abierta' : 'Tienda cerrada'}</div>}
      </div>
    </div>
  );
}

/** Controles del simulador de ventas (reloj virtual). */
export function SimulatorControls({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { running, speed, autoRefill } = state.simulator;
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => {
          dispatch({ type: 'SET_SIMULATOR', patch: { running: !running } });
          if (!running) toast('Simulación de ventas en marcha. Los gráficos y predicciones se actualizan en vivo.', 'info');
        }}
        className={`btn h-9 px-3 ${running ? 'bg-tag text-ink hover:bg-tag/80' : 'bg-ink text-white hover:bg-ink-soft'}`}
        aria-pressed={running}
      >
        {running ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {!compact && <span>{running ? 'Pausar' : 'Simular ventas'}</span>}
      </button>
      {!compact && (
        <div className="hidden items-center rounded-lg bg-page p-0.5 sm:flex" role="radiogroup" aria-label="Velocidad">
          {([1, 2, 4] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={speed === s}
              onClick={() => dispatch({ type: 'SET_SIMULATOR', patch: { speed: s } })}
              className={`num rounded-md px-2 py-1.5 text-xs font-bold ${speed === s ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink'}`}
            >
              {s}×
            </button>
          ))}
        </div>
      )}
      <div className="relative" ref={menuRef}>
        <button onClick={() => setMenu((m) => !m)} className="btn-outline h-9 px-2.5" aria-label="Más opciones de simulación" aria-expanded={menu}>
          <Settings2 size={16} aria-hidden />
        </button>
        {menu && (
          <div className="absolute right-0 top-11 z-50 w-72 rounded-xl bg-white p-2 shadow-pop ring-1 ring-line">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Reloj virtual</p>
            {compact && (
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm text-ink">Velocidad</span>
                <div className="flex rounded-lg bg-page p-0.5">
                  {([1, 2, 4] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => dispatch({ type: 'SET_SIMULATOR', patch: { speed: s } })}
                      className={`num rounded-md px-2 py-1 text-xs font-bold ${speed === s ? 'bg-white text-ink shadow-card' : 'text-muted'}`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            )}
            <MenuButton
              icon={FastForward}
              label="Avanzar 1 hora"
              hint="Simula las ventas de la próxima hora"
              onClick={() => {
                dispatch({ type: 'TICK', minutes: 60 });
                toast('Se simuló 1 hora de ventas.', 'info');
              }}
            />
            <MenuButton
              icon={CalendarClock}
              label="Cerrar día y abrir el siguiente"
              hint="Pasa las ventas al histórico, reentrena el modelo y recibe pedidos"
              onClick={() => {
                dispatch({ type: 'NEXT_DAY' });
                setMenu(false);
                toast('Día cerrado: el modelo se reentrenó con las ventas de hoy.', 'success');
              }}
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-page">
              <input
                type="checkbox"
                checked={autoRefill}
                onChange={(e) => dispatch({ type: 'SET_SIMULATOR', patch: { autoRefill: e.target.checked } })}
                className="mt-0.5 h-4 w-4 accent-ink"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">Reposición automática</span>
                <span className="block text-xs text-muted">El personal baja mercadería cuando la góndola cae del 30 %.</span>
              </span>
            </label>
            <div className="my-1 border-t border-line" />
            <MenuButton
              icon={RotateCcw}
              label="Restablecer datos de demostración"
              hint="Vuelve al estado inicial"
              onClick={() => {
                dispatch({ type: 'RESET' });
                setMenu(false);
                toast('Datos restablecidos.', 'info');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, hint, onClick }: { icon: typeof Play; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-page">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}
