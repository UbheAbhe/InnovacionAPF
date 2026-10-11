interface Option<T extends string | number> {
  value: T;
  label: string;
}

/** Control segmentado accesible (grupo de botones excluyentes). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'sm',
  ariaLabel,
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  size?: 'sm' | 'xs';
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg bg-page p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-semibold transition-colors ${size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} ${
              active ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
