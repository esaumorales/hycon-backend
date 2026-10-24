import { randomUUID } from 'crypto';
import {
  env,
  proveedorVideoActivo,
  r2Completo,
  streamCompleto,
} from '../../core/config/env';
import { AppError } from '../../core/errors/AppError';
import { extraerIdYoutube } from '../../core/utils/youtube';
import { crearAlmacenR2, type AlmacenR2 } from './r2.service';
import { crearAlmacenStream, type AlmacenStream } from './stream.service';
import { interpretarVideo, referenciaDe, type ProveedorVideo } from './referencias';

/** Como tiene que reproducirlo el navegador. */
export type TipoReproduccion = 'youtube' | 'archivo' | 'incrustado';

export interface Reproduccion {
  tipo: TipoReproduccion;
  // Enlace listo para reproducir; firmado y temporal cuando el video es nuestro
  url: string | null;
  youtubeId: string | null;
}

export interface SubidaVideo {
  proveedor: ProveedorVideo;
  metodo: 'PUT' | 'POST';
  url: string;
  // Lo que se guarda en la leccion cuando termina la subida
  referencia: string;
  // Stream recibe el archivo en un formulario; R2 lo recibe en el cuerpo del PUT
  campoArchivo: string | null;
}

// Formatos que el navegador reproduce sin ayuda de nadie
export const EXTENSIONES_VIDEO = ['mp4', 'webm', 'm4v', 'mov'] as const;

export const extensionDe = (nombre: string): string | null => {
  const encontrada = /\.([a-zA-Z0-9]+)$/.exec(nombre.trim());
  const extension = encontrada?.[1]?.toLowerCase();
  return extension && (EXTENSIONES_VIDEO as readonly string[]).includes(extension)
    ? extension
    : null;
};

export interface DependenciasVideos {
  proveedor: ProveedorVideo;
  r2: AlmacenR2 | null;
  stream: AlmacenStream | null;
  firmaSegundos: number;
  maximoMinutos: number;
  nombreNuevo(): string;
}

export const crearAlmacenVideos = (deps: DependenciasVideos) => {
  const exigirR2 = () => {
    if (!deps.r2) throw new AppError('El almacen de videos R2 no esta configurado', 503);
    return deps.r2;
  };

  const exigirStream = () => {
    if (!deps.stream) throw new AppError('Cloudflare Stream no esta configurado', 503);
    return deps.stream;
  };

  return {
    proveedor: deps.proveedor,
    // Con youtube el video se pega como enlace; los otros dos reciben archivos
    aceptaSubidas: deps.proveedor !== 'youtube',

    /**
     * Traduce lo guardado en un enlace que se puede reproducir ahora. Mira la
     * referencia, no la configuracion, para que los videos antiguos sigan viendose
     * despues de cambiar de proveedor.
     */
    async reproducir(valor: string | null): Promise<Reproduccion | null> {
      const referencia = interpretarVideo(valor);
      if (!referencia) return null;

      if (referencia.proveedor === 'youtube') {
        return {
          tipo: 'youtube',
          url: referencia.clave,
          youtubeId: extraerIdYoutube(referencia.clave),
        };
      }

      if (referencia.proveedor === 'r2') {
        const url = exigirR2().urlDeLectura(referencia.clave, deps.firmaSegundos);
        return { tipo: 'archivo', url, youtubeId: null };
      }

      const url = await exigirStream().urlDeReproduccion(referencia.clave, deps.firmaSegundos);
      return { tipo: 'incrustado', url, youtubeId: null };
    },

    /** Permiso temporal para que el navegador suba el archivo sin pasar por aqui. */
    async firmarSubida(cursoUuid: string, nombreArchivo: string): Promise<SubidaVideo> {
      if (deps.proveedor === 'youtube') {
        throw new AppError(
          'El servidor no tiene almacen de videos: pega un enlace de YouTube',
          503
        );
      }

      if (deps.proveedor === 'stream') {
        const stream = exigirStream();
        const { url, uid } = await stream.urlDeSubida(deps.maximoMinutos * 60);
        return {
          proveedor: 'stream',
          metodo: 'POST',
          url,
          referencia: referenciaDe('stream', uid),
          campoArchivo: 'file',
        };
      }

      const extension = extensionDe(nombreArchivo);
      if (!extension) {
        throw new AppError(
          `Formato no permitido. Usa ${EXTENSIONES_VIDEO.join(', ').toUpperCase()}`,
          415
        );
      }

      const r2 = exigirR2();
      const clave = r2.claveNueva(cursoUuid, deps.nombreNuevo(), extension);
      return {
        proveedor: 'r2',
        metodo: 'PUT',
        url: r2.urlDeSubida(clave, deps.firmaSegundos),
        referencia: referenciaDe('r2', clave),
        campoArchivo: null,
      };
    },

    /**
     * Borra el archivo cuando la leccion cambia de video o desaparece, para no
     * pagar por lo que ya no se usa. Un fallo aqui no interrumpe la operacion.
     */
    async eliminar(valor: string | null): Promise<boolean> {
      const referencia = interpretarVideo(valor);
      if (!referencia || referencia.proveedor === 'youtube') return false;

      try {
        if (referencia.proveedor === 'r2') await exigirR2().eliminar(referencia.clave);
        else await exigirStream().eliminar(referencia.clave);
        return true;
      } catch {
        return false;
      }
    },
  };
};

export type AlmacenVideos = ReturnType<typeof crearAlmacenVideos>;

export const almacenVideos = crearAlmacenVideos({
  proveedor: proveedorVideoActivo(),
  r2: r2Completo() ? crearAlmacenR2(env.R2) : null,
  stream: streamCompleto() ? crearAlmacenStream(env.STREAM) : null,
  firmaSegundos: env.VIDEO_FIRMA_MINUTOS * 60,
  maximoMinutos: env.VIDEO_MAXIMO_MINUTOS,
  nombreNuevo: randomUUID,
});
