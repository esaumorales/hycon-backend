import type { PaginaDe } from '../../modules/catalog/catalog.types';

/**
 * Filas de una pagina mas el total. Son dos lecturas independientes: se piden a la vez
 * pero sin transaccion, porque una transaccion retiene una conexion del pool y un
 * listado no necesita atomicidad. Asi un listado nunca puede fallar con P2028.
 */
export const listarConTotal = async <T>(
  consultarFilas: () => Promise<T[]>,
  contar: () => Promise<number>
): Promise<PaginaDe<T>> => {
  const [filas, total] = await Promise.all([consultarFilas(), contar()]);
  return { filas, total };
};
