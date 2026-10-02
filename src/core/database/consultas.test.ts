import { describe, expect, it, vi } from 'vitest';
import { listarConTotal } from './consultas';

describe('listarConTotal', () => {
  it('devuelve las filas y el total pedidos a la vez', async () => {
    const filas = vi.fn().mockResolvedValue([{ id: 1 }]);
    const total = vi.fn().mockResolvedValue(14);

    await expect(listarConTotal(filas, total)).resolves.toEqual({ filas: [{ id: 1 }], total: 14 });
    expect(filas).toHaveBeenCalledTimes(1);
    expect(total).toHaveBeenCalledTimes(1);
  });

  it('lanza las dos consultas en paralelo, sin esperar a que acabe la primera', async () => {
    const orden: string[] = [];
    const filas = () => new Promise<number[]>((resolver) => setTimeout(() => { orden.push('filas'); resolver([]); }, 20));
    const total = () => new Promise<number>((resolver) => setTimeout(() => { orden.push('total'); resolver(0); }, 5));

    await listarConTotal(filas, total);

    expect(orden).toEqual(['total', 'filas']);
  });
});
