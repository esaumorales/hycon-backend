import { createHash } from 'crypto';
import { AppError } from '../../core/errors/AppError';

export interface ConfiguracionCloudinary {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  carpeta: string;
}

export interface FirmaSubida {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

// Lo que se permite subir. Cloudinary tambien lo valida al recibir el archivo.
export const FORMATOS_PERMITIDOS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/** Cloudinary firma con los parametros ordenados y el secreto pegado al final. */
const firmar = (parametros: Record<string, string>, apiSecret: string): string => {
  const base = Object.keys(parametros)
    .sort()
    .map((clave) => `${clave}=${parametros[clave]}`)
    .join('&');
  return createHash('sha1').update(base + apiSecret).digest('hex');
};

/**
 * Subida directa desde el navegador: el backend solo firma, asi el api secret
 * nunca sale del servidor y los archivos no pasan por el.
 */
export const crearAlmacenCloudinary = (config: ConfiguracionCloudinary) => {
  const { cloudName, apiKey, apiSecret, carpeta } = config;
  const prefijo = `https://res.cloudinary.com/${cloudName}/`;

  // Una URL de Cloudinary termina en <carpetas>/<public_id>.<extension>, con
  // la version delante: .../upload/v1699999999/hycon/catalogo/abc123.webp
  const publicIdDe = (url: string): string | null => {
    if (!url.startsWith(prefijo)) return null;
    const partes = url.slice(prefijo.length).split('/');
    const subida = partes.indexOf('upload');
    if (subida === -1) return null;

    const resto = partes.slice(subida + 1).filter((parte) => !/^v\d+$/.test(parte));
    if (resto.length === 0) return null;

    const completo = resto.join('/');
    return completo.replace(/\.[a-zA-Z0-9]+$/, '') || null;
  };

  return {
    esSuya: (url: string) => url.startsWith(prefijo),
    publicIdDe,

    /** Firma una subida a la subcarpeta indicada (catalogo, avatares...). */
    firmarSubida(subcarpeta: string): FirmaSubida {
      const folder = `${carpeta}/${subcarpeta}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = firmar({ folder, timestamp: String(timestamp) }, apiSecret);
      return { cloudName, apiKey, timestamp, folder, signature };
    },

    /** Borra la imagen anterior. Un fallo aqui no debe tumbar la operacion. */
    async eliminar(url: string): Promise<void> {
      const publicId = publicIdDe(url);
      if (!publicId) return;

      const timestamp = Math.floor(Date.now() / 1000);
      const cuerpo = new URLSearchParams({
        public_id: publicId,
        timestamp: String(timestamp),
        api_key: apiKey,
        signature: firmar({ public_id: publicId, timestamp: String(timestamp) }, apiSecret),
      });

      const respuesta = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
        { method: 'POST', body: cuerpo }
      );
      if (!respuesta.ok) {
        throw new AppError('No se pudo borrar la imagen anterior en Cloudinary', 502);
      }
    },
  };
};

export type AlmacenCloudinary = ReturnType<typeof crearAlmacenCloudinary>;
