import { NavLink } from 'react-router-dom';
import { useStore } from '@/store/StoreProvider';
import { NAV } from './nav';

/** Barra de navegación inferior (móvil y tablet). */
export function MobileNav() {
  const { alerts } = useStore();
  const urgent = alerts.filter((a) => a.severity === 'critico' || a.severity === 'alto').length;
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {NAV.map(({ to, short, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `relative flex flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 text-[10px] font-semibold ${isActive ? 'text-brand' : 'text-muted'}`
          }
        >
          <span className="relative">
            <Icon size={20} aria-hidden />
            {to === '/alertas' && urgent > 0 && (
              <span className="num absolute -right-2.5 -top-1.5 min-w-[16px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-4 text-white">
                {urgent > 99 ? '99+' : urgent}
              </span>
            )}
          </span>
          <span className="truncate">{short}</span>
        </NavLink>
      ))}
    </nav>
  );
}
