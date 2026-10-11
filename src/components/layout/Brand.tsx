export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="figure grid shrink-0 place-items-center rounded-lg bg-brand text-white"
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      aria-hidden
    >
      3A
    </span>
  );
}
