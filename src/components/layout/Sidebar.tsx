import { NavLink } from 'react-router-dom';
import { useStore } from '@/store/StoreProvider';
import { BrandMark } from './Brand';
import { NAV } from './nav';

/** Navegación lateral (escritorio). */
export function Sidebar() {
  const { alerts } = useStore();
  const urgent = alerts.filter((a) => a.severity === 'critico' || a.severity === 'alto').length;
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#1A1D24] text-white lg:flex">
      <div className="flex items-center gap-3 px-5 pb-6 pt-5">
        <BrandMark />
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight">Inventario 3A</div>
          <div className="text-[11px] text-white/55">Sede Av. Tantamayo · SMP</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Secciones">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-tag" aria-hidden />}
                <Icon size={18} aria-hidden />
                <span className="flex-1">{label}</span>
                {to === '/alertas' && urgent > 0 && (
                  <span className="num rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{urgent}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-lg bg-white/5 p-3 text-[11px] leading-snug text-white/55">
        Prototipo con datos simulados en memoria. Las predicciones son generadas por un modelo estadístico; la decisión final es del administrador.
      </div>
    </aside>
  );
}
