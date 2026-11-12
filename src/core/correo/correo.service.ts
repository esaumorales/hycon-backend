import { env } from '../config/env';

export interface ConfiguracionCorreo {
  apiKey: string;
  // Direccion desde la que sale el correo, ya verificada en Resend
  remitente: string;
}

export interface Mensaje {
  para: string;
  asunto: string;
  texto: string;
  // A donde contesta quien recibe el aviso; sirve para responder al cliente
  responderA?: string;
}

const URL_RESEND = 'https://api.resend.com/emails';

/**
 * Envio de correo por Resend. Se habla con su API por HTTP para no sumar otra
 * dependencia: lo unico que hace falta es la clave y un remitente verificado.
 */
export const crearCorreo = (config: ConfiguracionCorreo) => {
  const configurado = Boolean(config.apiKey && config.remitente);

  return {
    configurado,

    /**
     * Devuelve true si el correo salio. Nunca lanza: un fallo del proveedor no
     * puede tumbar la operacion que lo pidio.
     */
    async enviar(mensaje: Mensaje): Promise<boolean> {
      if (!configurado) return false;

      try {
        const respuesta = await fetch(URL_RESEND, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: config.remitente,
            to: [mensaje.para],
            subject: mensaje.asunto,
            text: mensaje.texto,
            ...(mensaje.responderA ? { reply_to: mensaje.responderA } : {}),
          }),
        });

        if (!respuesta.ok) {
          console.error(`[correo] Resend respondio ${respuesta.status} al enviar "${mensaje.asunto}"`);
          return false;
        }
        return true;
      } catch (fallo) {
        console.error('[correo] no se pudo contactar con Resend:', fallo);
        return false;
      }
    },
  };
};

export type Correo = ReturnType<typeof crearCorreo>;

/**
 * El correo de la aplicacion. En las pruebas se deja sin configurar a proposito:
 * con las claves puestas en el .env, cada corrida de la bateria mandaria correos
 * de verdad.
 */
export const correo = crearCorreo(
  process.env.VITEST === undefined
    ? { apiKey: env.CORREO.apiKey, remitente: env.CORREO.remitente }
    : { apiKey: '', remitente: '' }
);
