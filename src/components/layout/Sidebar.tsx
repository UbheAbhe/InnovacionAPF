import { NavLink } from 'react-router-dom';
import { useStore } from '@/store/StoreProvider';
import { BrandMark } from './Brand';
import { NAV } from './nav';

/** Navegación lateral (escritorio): letrero naranja sobre la franja azul de la fachada 3A. */
export function Sidebar() {
  const { alerts } = useStore();
  const urgent = alerts.filter((a) => a.severity === 'critico' || a.severity === 'alto').length;
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy text-white lg:flex">
      <div className="flex items-center gap-3 bg-brand-dark px-5 py-4">
        <BrandMark size={38} inverse />
        <div className="leading-tight">
          <div className="display text-[19px]">Inventario 3A</div>
          <div className="text-xs text-white/90">Sede Av. Tantamayo, SMP</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-5" aria-label="Secciones">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-white text-ink' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-brand-dark' : ''} aria-hidden />
                <span className="flex-1">{label}</span>
                {to === '/alertas' && urgent > 0 && (
                  <span className="num min-w-[22px] rounded-full bg-brand-dark px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">{urgent}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <p className="mx-5 mb-5 border-t border-navy-line pt-4 text-[11px] leading-relaxed text-white/70">
        Prototipo con datos simulados en memoria. Las predicciones son generadas por un modelo estadístico; la decisión final es del administrador.
      </p>
    </aside>
  );
}
