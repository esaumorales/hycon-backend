import { describe, expect, it } from 'vitest';
import { crearRegistroIntentos } from './auth.intentos';

const MINUTO = 60_000;

describe('registro de intentos en memoria', () => {
  it('bloquea al llegar al maximo de fallos', () => {
    const registro = crearRegistroIntentos({ maxIntentos: 3, bloqueoMs: 15 * MINUTO });

    expect(registro.registrarFallo('x@y.com', 0)).toBeNull();
    expect(registro.registrarFallo('x@y.com', 1000)).toBeNull();
    expect(registro.registrarFallo('x@y.com', 2000)).toBe(2000 + 15 * MINUTO);
    expect(registro.bloqueadoHasta('x@y.com', 3000)).toBe(2000 + 15 * MINUTO);
  });

  it('al cumplirse el bloqueo el contador empieza de nuevo', () => {
    const registro = crearRegistroIntentos({ maxIntentos: 2, bloqueoMs: MINUTO });
    registro.registrarFallo('x@y.com', 0);
    registro.registrarFallo('x@y.com', 0);

    expect(registro.bloqueadoHasta('x@y.com', MINUTO + 1)).toBeNull();
    expect(registro.registrarFallo('x@y.com', MINUTO + 1)).toBeNull();
  });

  it('cada correo lleva su propia cuenta', () => {
    const registro = crearRegistroIntentos({ maxIntentos: 2, bloqueoMs: MINUTO });
    registro.registrarFallo('a@y.com', 0);
    registro.registrarFallo('a@y.com', 0);

    expect(registro.bloqueadoHasta('b@y.com', 1)).toBeNull();
  });

  it('no crece sin limite aunque lleguen miles de correos distintos', () => {
    const registro = crearRegistroIntentos({ maxIntentos: 5, bloqueoMs: MINUTO, maxEntradas: 100 });
    for (let i = 0; i < 1000; i += 1) registro.registrarFallo(`bot${i}@spam.com`, i);

    expect(registro.tamano).toBe(100);
  });
});
