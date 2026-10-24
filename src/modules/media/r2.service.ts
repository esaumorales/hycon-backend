import { createHash, createHmac } from 'crypto';
import { AppError } from '../../core/errors/AppError';

export interface ConfiguracionR2 {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  // Carpeta donde se agrupan los videos dentro del bucket
  carpeta: string;
}

export type MetodoS3 = 'GET' | 'PUT' | 'DELETE';

const SERVICIO = 's3';
const ALGORITMO = 'AWS4-HMAC-SHA256';
// En una URL firmada el cuerpo no se firma: lo manda el navegador despues
const CUERPO_SIN_FIRMAR = 'UNSIGNED-PAYLOAD';

const sha256 = (valor: string) => createHash('sha256').update(valor, 'utf8').digest('hex');

const hmac = (clave: Buffer | string, dato: string) =>
  createHmac('sha256', clave).update(dato, 'utf8').digest();

// S3 exige RFC 3986; encodeURIComponent deja sin codificar estos cinco
const codificar = (valor: string) =>
  encodeURIComponent(valor).replace(
    /[!'()*]/g,
    (caracter) => `%${caracter.charCodeAt(0).toString(16).toUpperCase()}`
  );

/** Cada tramo se codifica por separado para no tocar las barras de la ruta. */
export const codificarRuta = (ruta: string) => ruta.split('/').map(codificar).join('/');

// AWS pide la fecha como 20260101T120000Z
const marcaDeTiempo = (fecha: Date) =>
  fecha.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export interface DatosFirma {
  metodo: MetodoS3;
  host: string;
  // Ruta absoluta y ya codificada, empezando por /
  ruta: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fecha: Date;
  segundos: number;
}

/**
 * Firma una URL con Signature Version 4, el protocolo de S3. La firma viaja en
 * la URL y caduca sola, asi el navegador habla directo con el almacen y la clave
 * secreta nunca sale del servidor.
 */
export const firmarConsultaS3 = (datos: DatosFirma): string => {
  const fecha = marcaDeTiempo(datos.fecha);
  const dia = fecha.slice(0, 8);
  const ambito = `${dia}/${datos.region}/${SERVICIO}/aws4_request`;

  const consulta = new URLSearchParams({
    'X-Amz-Algorithm': ALGORITMO,
    'X-Amz-Credential': `${datos.accessKeyId}/${ambito}`,
    'X-Amz-Date': fecha,
    'X-Amz-Expires': String(datos.segundos),
    'X-Amz-SignedHeaders': 'host',
  });
  consulta.sort();

  const peticionCanonica = [
    datos.metodo,
    datos.ruta,
    consulta.toString(),
    `host:${datos.host}\n`,
    'host',
    CUERPO_SIN_FIRMAR,
  ].join('\n');

  const porFirmar = [ALGORITMO, fecha, ambito, sha256(peticionCanonica)].join('\n');
  const claveDeFirma = hmac(
    hmac(hmac(hmac(`AWS4${datos.secretAccessKey}`, dia), datos.region), SERVICIO),
    'aws4_request'
  );
  const firma = createHmac('sha256', claveDeFirma).update(porFirmar, 'utf8').digest('hex');

  return `https://${datos.host}${datos.ruta}?${consulta.toString()}&X-Amz-Signature=${firma}`;
};

// R2 no tiene regiones: el ambito de la firma siempre es este
const REGION_R2 = 'auto';

/**
 * Cloudflare R2 habla el protocolo de S3. Cobra por lo guardado y no por lo que
 * se ve, asi que el trafico de los alumnos no suma en la factura.
 */
export const crearAlmacenR2 = (config: ConfiguracionR2, reloj: () => Date = () => new Date()) => {
  const { accountId, accessKeyId, secretAccessKey, bucket, carpeta } = config;
  const host = `${accountId}.r2.cloudflarestorage.com`;

  const firmar = (metodo: MetodoS3, clave: string, segundos: number) =>
    firmarConsultaS3({
      metodo,
      host,
      ruta: `/${codificarRuta(`${bucket}/${clave}`)}`,
      region: REGION_R2,
      accessKeyId,
      secretAccessKey,
      fecha: reloj(),
      segundos,
    });

  return {
    /** Ruta donde se guarda el video de una leccion, unica para no pisar nada. */
    claveNueva: (cursoUuid: string, nombre: string, extension: string) =>
      `${carpeta}/${cursoUuid}/${nombre}.${extension}`,

    /** Enlace temporal para ver el video. Al caducar deja de servir. */
    urlDeLectura: (clave: string, segundos: number) => firmar('GET', clave, segundos),

    /** Enlace temporal para que el navegador suba el archivo con un PUT. */
    urlDeSubida: (clave: string, segundos: number) => firmar('PUT', clave, segundos),

    async eliminar(clave: string): Promise<void> {
      const respuesta = await fetch(firmar('DELETE', clave, 60), { method: 'DELETE' });
      // R2 responde 204 al borrar y 404 si ya no estaba: ninguno es un problema
      if (!respuesta.ok && respuesta.status !== 404) {
        throw new AppError('No se pudo borrar el video anterior en R2', 502);
      }
    },
  };
};

export type AlmacenR2 = ReturnType<typeof crearAlmacenR2>;
