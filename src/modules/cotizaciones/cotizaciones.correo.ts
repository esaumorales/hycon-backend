import type { Correo } from '../../core/correo/correo.service';
import type { CotizacionPublica } from './cotizaciones.service';

const precio = (valor: number) => `S/ ${valor.toFixed(2)}`;

const detalle = (cotizacion: CotizacionPublica) =>
  cotizacion.evaluaciones
    .map((evaluacion) => `- ${evaluacion.nombre} (${evaluacion.norma}): ${precio(evaluacion.precio)}`)
    .join('\n');

/** Lo que recibe el equipo: todo lo que hace falta para llamar al cliente. */
export const textoParaElEquipo = (cotizacion: CotizacionPublica) =>
  [
    `Nueva solicitud de cotizacion: ${cotizacion.codigo}`,
    '',
    `Nombre:  ${cotizacion.nombre}`,
    `Empresa: ${cotizacion.empresa ?? 'no indica'}`,
    `Celular: ${cotizacion.telefono}`,
    `Correo:  ${cotizacion.correo}`,
    '',
    'Evaluaciones pedidas:',
    detalle(cotizacion),
    '',
    `Total referencial: ${precio(cotizacion.total)}`,
    '',
    cotizacion.mensaje ? `Lo que cuenta:\n${cotizacion.mensaje}` : 'Sin mensaje adicional.',
  ].join('\n');

/** El acuse del cliente: que pidio y que va a pasar ahora. */
export const textoParaElCliente = (cotizacion: CotizacionPublica) =>
  [
    `Hola ${cotizacion.nombre},`,
    '',
    `Recibimos tu solicitud de cotizacion con el codigo ${cotizacion.codigo}.`,
    'Te escribimos para coordinar el alcance y las fechas disponibles.',
    '',
    'Esto fue lo que pediste:',
    detalle(cotizacion),
    '',
    `Total referencial: ${precio(cotizacion.total)}`,
    'El precio final se confirma al cerrar el alcance de la evaluacion.',
    '',
    'Gracias,',
    'Equipo Hycon',
  ].join('\n');

export interface AvisoCotizaciones {
  nueva(cotizacion: CotizacionPublica): Promise<void>;
}

/**
 * Avisa al equipo y manda el acuse al cliente. No lanza nunca: una solicitud
 * guardada no puede perderse porque el proveedor de correo falle.
 */
export const crearAvisoCotizaciones = (correo: Correo, destinoEquipo: string): AvisoCotizaciones => ({
  async nueva(cotizacion) {
    if (!correo.configurado || !destinoEquipo) {
      console.warn(
        `[cotizaciones] ${cotizacion.codigo} guardada, pero no hay correo configurado: nadie recibio el aviso`
      );
      return;
    }

    await Promise.all([
      correo.enviar({
        para: destinoEquipo,
        asunto: `Nueva cotizacion ${cotizacion.codigo} - ${cotizacion.empresa ?? cotizacion.nombre}`,
        texto: textoParaElEquipo(cotizacion),
        // Responder al aviso escribe directamente al cliente
        responderA: cotizacion.correo,
      }),
      correo.enviar({
        para: cotizacion.correo,
        asunto: `Recibimos tu solicitud (${cotizacion.codigo})`,
        texto: textoParaElCliente(cotizacion),
        responderA: destinoEquipo,
      }),
    ]);
  },
});
