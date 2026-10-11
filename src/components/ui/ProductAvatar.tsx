import type { Category, Product } from '@/domain/types';
import { categoryColor } from '@/lib/colors';

export function ProductAvatar({ product, category, size = 36 }: { product: Product; category?: Category; size?: number }) {
  const color = categoryColor(category?.colorSlot ?? 0);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg"
      style={{ width: size, height: size, background: `${color}1F`, fontSize: size * 0.5 }}
      aria-hidden
    >
      {product.emoji}
    </span>
  );
}
