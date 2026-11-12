import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { cloudinaryActivo, env } from '../../core/config/env';
import { crearAlmacenCloudinary } from './cloudinary.service';
import { AppError } from '../../core/errors/AppError';

export const TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024;
export const CARPETA_IMAGENES = 'imagenes';
export const RUTA_PUBLICA_UPLOADS = '/uploads';

export type TipoImagen = 'jpg' | 'png' | 'webp' | 'gif';

// El mimetype lo decide el navegador y se puede falsificar: se comprueba la firma real del archivo
export const detectarTipoImagen = (contenido: Uint8Array): TipoImagen | null => {
  const empiezaCon = (firma: number[], desde = 0) =>
    contenido.length >= desde + firma.length &&
    firma.every((byte, indice) => contenido[desde + indice] === byte);

  if (empiezaCon([0xff, 0xd8, 0xff])) return 'jpg';
  if (empiezaCon([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (empiezaCon([0x47, 0x49, 0x46, 0x38])) return 'gif';
  // RIFF....WEBP
  if (empiezaCon([0x52, 0x49, 0x46, 0x46]) && empiezaCon([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  return null;
};

interface ConfiguracionAlmacen {
  carpetaRaiz: string;
  urlPublica: string;
}

export const crearAlmacenImagenes = ({ carpetaRaiz, urlPublica }: ConfiguracionAlmacen) => {
  const carpetaImagenes = path.resolve(carpetaRaiz, CARPETA_IMAGENES);
  const prefijoUrl = `${urlPublica}${RUTA_PUBLICA_UPLOADS}/${CARPETA_IMAGENES}/`;

  // Traduce una URL publica a su ruta en disco, solo si apunta a un archivo nuestro.
  // Cualquier URL externa o con ../ devuelve null y no se toca.
  const rutaLocalDe = (url: string): string | null => {
    if (!url.startsWith(prefijoUrl)) return null;
    const nombre = url.slice(prefijoUrl.length);
    if (!/^[a-zA-Z0-9-]+\.(jpg|png|webp|gif)$/.test(nombre)) return null;
    return path.join(carpetaImagenes, nombre);
  };

  return {
    rutaLocalDe,

    async guardar(contenido: Buffer): Promise<{ url: string; tipo: TipoImagen; bytes: number }> {
      if (contenido.length === 0) {
        throw new AppError('El archivo esta vacio', 422);
      }
      if (contenido.length > TAMANO_MAXIMO_IMAGEN) {
        throw new AppError('La imagen supera el maximo de 5 MB', 413);
      }

      const tipo = detectarTipoImagen(contenido);
      if (!tipo) {
        throw new AppError('Formato no permitido. Usa JPG, PNG, WEBP o GIF', 415);
      }

      const nombre = `${randomUUID()}.${tipo}`;
      await fs.mkdir(carpetaImagenes, { recursive: true });
      await fs.writeFile(path.join(carpetaImagenes, nombre), contenido);

      return { url: `${prefijoUrl}${nombre}`, tipo, bytes: contenido.length };
    },

    // Limpieza de mejor esfuerzo: si el archivo ya no esta, no es un error
    async eliminar(url: string): Promise<boolean> {
      const ruta = rutaLocalDe(url);
      if (!ruta) return false;
      try {
        await fs.unlink(ruta);
        return true;
      } catch {
        return false;
      }
    },
  };
};

export type AlmacenImagenes = ReturnType<typeof crearAlmacenImagenes>;

const almacenDisco = crearAlmacenImagenes({
  carpetaRaiz: env.UPLOADS_DIR,
  urlPublica: env.PUBLIC_URL,
});

export const almacenCloudinary = cloudinaryActivo()
  ? crearAlmacenCloudinary(env.CLOUDINARY)
  : null;

/**
 * Punto unico para borrar una imagen. Convive el historial: las antiguas estan
 * en disco y las nuevas en Cloudinary, asi que se mira la URL para saber a quien
 * pedirselo. Un fallo al borrar nunca interrumpe la operacion principal.
 */
export const almacenImagenes = {
  ...almacenDisco,
  async eliminar(url: string): Promise<boolean> {
    if (almacenCloudinary?.esSuya(url)) {
      try {
        await almacenCloudinary.eliminar(url);
        return true;
      } catch {
        return false;
      }
    }
    return almacenDisco.eliminar(url);
  },
};
