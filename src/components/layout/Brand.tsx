/** Monograma 3A. `inverse`: versión blanca para usar sobre el naranja de la marca. */
export function BrandMark({ size = 34, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <span
      className={`figure grid shrink-0 place-items-center rounded-md ${inverse ? 'bg-white text-navy' : 'bg-brand-dark text-white'}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      3A
    </span>
  );
}
