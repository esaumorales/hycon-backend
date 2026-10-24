import { AppError } from '../../core/errors/AppError';

export interface ConfiguracionStream {
  accountId: string;
  apiToken: string;
  // El dominio que da Cloudflare: customer-xxxxx.cloudflarestream.com
  dominio: string;
}

interface RespuestaCloudflare<T> {
  success: boolean;
  result?: T;
  errors?: { message?: string }[];
}

// Margen para no entregar un token que caduca mientras se esta viendo
const MARGEN_CACHE_SEGUNDOS = 60;

/**
 * Cloudflare Stream guarda, convierte y sirve el video en varias calidades.
 * El reproductor va en un iframe con un token firmado que caduca, asi el
 * enlace no se puede repartir.
 */
export const crearAlmacenStream = (
  config: ConfiguracionStream,
  reloj: () => number = () => Date.now()
) => {
  const base = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream`;
  // Un token por video mientras siga vigente: evita pedirlo en cada reproduccion
  const tokens = new Map<string, { url: string; expiraEn: number }>();

  const pedir = async <T>(ruta: string, opciones: RequestInit = {}): Promise<T> => {
    const respuesta = await fetch(`${base}${ruta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
        ...opciones.headers,
      },
    });

    const datos = (await respuesta.json().catch(() => ({}))) as RespuestaCloudflare<T>;
    if (!respuesta.ok || !datos.success || datos.result === undefined) {
      throw new AppError(datos.errors?.[0]?.message ?? 'Cloudflare Stream rechazo la peticion', 502);
    }
    return datos.result;
  };

  return {
    /**
     * Pide un destino de subida de un solo uso. El navegador manda ahi el
     * archivo y Cloudflare lo convierte; el uid ya se puede guardar.
     */
    async urlDeSubida(maxDuracionSegundos: number): Promise<{ url: string; uid: string }> {
      const resultado = await pedir<{ uploadURL: string; uid: string }>('/direct_upload', {
        method: 'POST',
        body: JSON.stringify({ maxDurationSeconds: maxDuracionSegundos, requireSignedURLs: true }),
      });
      return { url: resultado.uploadURL, uid: resultado.uid };
    },

    /** Enlace del reproductor con el token ya incluido. */
    async urlDeReproduccion(uid: string, segundos: number): Promise<string> {
      const ahora = Math.floor(reloj() / 1000);
      const guardado = tokens.get(uid);
      if (guardado && guardado.expiraEn - MARGEN_CACHE_SEGUNDOS > ahora) return guardado.url;

      const { token } = await pedir<{ token: string }>(`/${uid}/token`, {
        method: 'POST',
        body: JSON.stringify({ exp: ahora + segundos }),
      });

      const url = `https://${config.dominio}/${token}/iframe`;
      tokens.set(uid, { url, expiraEn: ahora + segundos });
      return url;
    },

    async eliminar(uid: string): Promise<void> {
      tokens.delete(uid);
      const respuesta = await fetch(`${base}/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.apiToken}` },
      });
      if (!respuesta.ok && respuesta.status !== 404) {
        throw new AppError('No se pudo borrar el video anterior en Cloudflare Stream', 502);
      }
    },
  };
};

export type AlmacenStream = ReturnType<typeof crearAlmacenStream>;
