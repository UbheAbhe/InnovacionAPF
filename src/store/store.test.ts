import { describe, expect, it } from 'vitest';
import { trueDailyDemand } from '@/data/demand';
import { cumulativeShare } from '@/engine/intraday';
import { addDays, toDateKey } from '@/lib/dates';
import { reducer } from './reducer';
import { createInitialState } from './state';

const START = new Date(2026, 9, 10, 10, 0).getTime(); // sábado 10/10/2026 10:00

describe('estado global y simulador', () => {
  it('genera 56 días de histórico y ventas parciales de hoy', () => {
    const s = createInitialState(START);
    const h = s.history['fv-mandarina'];
    expect(h).toHaveLength(56);
    expect(h[h.length - 1].date).toBe('2026-10-09');
    expect(s.todaySales['fv-mandarina']).toBeGreaterThan(0);
  });

  it('las ventas parciales de hoy son proporcionales a la hora del día', () => {
    const s = createInitialState(START);
    const sold = s.products.reduce((a, p) => a + s.todaySales[p.id] * p.price, 0);
    const truth = s.products.reduce((a, p) => a + trueDailyDemand(p.id, '2026-10-10', '2026-10-10') * p.price, 0);
    const ratio = sold / (truth * cumulativeShare(new Date(START)));
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(1.25);
  });

  it('una venta manual descuenta góndola y registra kardex', () => {
    const s = createInitialState(START);
    const before = s.products.find((p) => p.id === 'aba-arroz')!;
    const next = reducer(s, { type: 'SELL', productId: 'aba-arroz', qty: 5 });
    const after = next.products.find((p) => p.id === 'aba-arroz')!;
    expect(after.stockGondola).toBe(before.stockGondola - 5);
    expect(next.todaySales['aba-arroz']).toBe(s.todaySales['aba-arroz'] + 5);
    expect(next.movements[0].type).toBe('VENTA');
  });

  it('vender más de lo que hay en góndola genera venta perdida', () => {
    const s = createInitialState(START);
    const p = s.products.find((x) => x.id === 'aba-aceite')!;
    const next = reducer(s, { type: 'SELL', productId: 'aba-aceite', qty: p.stockGondola + 3 });
    expect(next.products.find((x) => x.id === 'aba-aceite')!.stockGondola).toBe(0);
    expect(next.lost.units).toBe(3);
  });

  it('reponer góndola mueve stock desde almacén', () => {
    const s = createInitialState(START);
    const next = reducer(s, { type: 'REFILL', productId: 'fv-mandarina', qty: 5 });
    const a = s.products.find((x) => x.id === 'fv-mandarina')!;
    const b = next.products.find((x) => x.id === 'fv-mandarina')!;
    expect(b.stockGondola).toBe(a.stockGondola + 5);
    expect(b.stockAlmacen).toBe(a.stockAlmacen - 5);
  });

  it('el simulador avanza el reloj y genera ventas', () => {
    const s = createInitialState(START);
    const next = reducer(s, { type: 'TICK', minutes: 120 });
    expect(next.now - s.now).toBe(120 * 60_000);
    const soldBefore = Object.values(s.todaySales).reduce((a, b) => a + b, 0);
    const soldAfter = Object.values(next.todaySales).reduce((a, b) => a + b, 0);
    expect(soldAfter).toBeGreaterThan(soldBefore);
  });

  it('el cierre de día pasa ventas al histórico y recibe pedidos', () => {
    const s = createInitialState(START);
    const next = reducer(s, { type: 'NEXT_DAY' });
    expect(toDateKey(new Date(next.now))).toBe(addDays('2026-10-10', 1));
    expect(next.history['fv-mandarina']).toHaveLength(57);
    expect(next.dayCloses).toHaveLength(1);
    const aceite = s.orders.find((o) => o.productId === 'aba-aceite')!;
    expect(next.orders.find((o) => o.id === aceite.id)!.status).toBe('recibido');
  });

  it('crear pedido calcula la fecha de llegada con el tiempo de entrega', () => {
    const s = createInitialState(START);
    const next = reducer(s, { type: 'CREATE_ORDERS', items: [{ productId: 'cui-protex', qty: 12 }] });
    expect(next.orders[0].etaDate).toBe(addDays('2026-10-10', 5));
  });
});
