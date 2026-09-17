/**
 * Contador de intentos fallidos para correos que NO existen en la base.
 * Las cuentas reales guardan su contador en la tabla users; este registro en
 * memoria aplica la misma regla a los correos inexistentes, para que el bloqueo
 * no delate que correos estan registrados.
 *
 * Nota: vive en memoria del proceso. Con varias instancias del backend conviene
 * moverlo a un almacen compartido (Redis).
 */
export interface OpcionesIntentos {
  maxIntentos: number;
  bloqueoMs: number;
  // Tope de correos recordados, para que nadie agote la memoria con correos aleatorios
  maxEntradas?: number;
}

interface Entrada {
  intentos: number;
  bloqueadoHasta: number | null;
}

export const crearRegistroIntentos = ({ maxIntentos, bloqueoMs, maxEntradas = 10000 }: OpcionesIntentos) => {
  const entradas = new Map<string, Entrada>();

  const vigente = (clave: string, ahora: number): Entrada | undefined => {
    const entrada = entradas.get(clave);
    // Un bloqueo cumplido se olvida: el contador vuelve a empezar
    if (entrada?.bloqueadoHasta !== null && entrada?.bloqueadoHasta !== undefined && entrada.bloqueadoHasta <= ahora) {
      entradas.delete(clave);
      return undefined;
    }
    return entrada;
  };

  return {
    bloqueadoHasta(clave: string, ahora: number): number | null {
      return vigente(clave, ahora)?.bloqueadoHasta ?? null;
    },

    // Suma un fallo y devuelve hasta cuando queda bloqueado, si llego al limite
    registrarFallo(clave: string, ahora: number): number | null {
      const entrada = vigente(clave, ahora) ?? { intentos: 0, bloqueadoHasta: null };
      entrada.intentos += 1;
      if (entrada.intentos >= maxIntentos) entrada.bloqueadoHasta = ahora + bloqueoMs;

      // Se reinserta para que el orden del Map refleje el uso mas reciente
      entradas.delete(clave);
      entradas.set(clave, entrada);
      if (entradas.size > maxEntradas) {
        const masAntigua = entradas.keys().next().value;
        if (masAntigua !== undefined) entradas.delete(masAntigua);
      }
      return entrada.bloqueadoHasta;
    },

    limpiar(clave: string) {
      entradas.delete(clave);
    },

    get tamano() {
      return entradas.size;
    },
  };
};

export type RegistroIntentos = ReturnType<typeof crearRegistroIntentos>;
