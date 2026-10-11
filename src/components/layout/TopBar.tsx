import { BrandMark } from './Brand';
import { GlobalSearch } from './GlobalSearch';
import { SimulatorControls, VirtualClock } from './SimulatorControls';

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      {/* Móvil */}
      <div className="flex items-center gap-3 px-4 pt-3 lg:hidden">
        <BrandMark size={30} />
        <div className="min-w-0 flex-1">
          <VirtualClock />
        </div>
        <SimulatorControls compact />
      </div>
      <div className="flex items-center gap-4 px-4 py-3 lg:px-6">
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <GlobalSearch />
        </div>
        <div className="ml-auto hidden items-center gap-4 lg:flex">
          <VirtualClock />
          <SimulatorControls />
        </div>
      </div>
    </header>
  );
}
