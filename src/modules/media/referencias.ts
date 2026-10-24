import { extraerIdYoutube } from '../../core/utils/youtube';

export type ProveedorVideo = 'youtube' | 'r2' | 'stream';

export interface ReferenciaVideo {
  proveedor: ProveedorVideo;
  // En r2 la ruta del archivo, en stream el uid del video y en youtube el enlace
  clave: string;
}

export const PREFIJOS = { r2: 'r2:', stream: 'stream:' } as const;

// La clave viaja dentro de una URL firmada: sin saltos de carpeta ni caracteres raros
const CLAVE_R2 = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,200}$/;
const UID_STREAM = /^[a-zA-Z0-9]{20,64}$/;

/** Como se guarda en la base el video de una leccion. */
export const referenciaDe = (proveedor: ProveedorVideo, clave: string): string =>
  proveedor === 'youtube' ? clave : `${PREFIJOS[proveedor]}${clave}`;

/**
 * Lee lo guardado y dice de donde sale ese video. Cada leccion lleva su propio
 * proveedor, asi que cambiar el de las subidas nuevas no rompe las anteriores.
 */
export const interpretarVideo = (valor: string | null | undefined): ReferenciaVideo | null => {
  const texto = valor?.trim();
  if (!texto) return null;

  if (texto.startsWith(PREFIJOS.r2)) {
    const clave = texto.slice(PREFIJOS.r2.length);
    const valida = CLAVE_R2.test(clave) && !clave.includes('..') && !clave.includes('//');
    return valida ? { proveedor: 'r2', clave } : null;
  }

  if (texto.startsWith(PREFIJOS.stream)) {
    const clave = texto.slice(PREFIJOS.stream.length);
    return UID_STREAM.test(clave) ? { proveedor: 'stream', clave } : null;
  }

  return extraerIdYoutube(texto) ? { proveedor: 'youtube', clave: texto } : null;
};

/** Vale un enlace de YouTube o una referencia a un video ya subido. */
export const esVideoValido = (valor: string): boolean => interpretarVideo(valor) !== null;
