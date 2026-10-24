import { createHmac } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearAlmacenR2, firmarConsultaS3 } from './r2.service';

const CONFIG = {
  accountId: '0ab1cd2ef3',
  accessKeyId: 'clave-de-acceso',
  secretAccessKey: 'secreto-que-no-sale-de-aqui',
  bucket: 'hycon-videos',
  carpeta: 'cursos',
};

const RELOJ = () => new Date('2026-10-16T12:00:00.000Z');
const UNA_HORA = 3600;

const almacen = () => crearAlmacenR2(CONFIG, RELOJ);

const parametros = (url: string) => new URL(url).searchParams;

// El caso de ejemplo que AWS publica para una URL firmada, con el resumen de
// su peticion canonica tal como aparece en su documentacion
const EJEMPLO_AWS = {
  host: 'examplebucket.s3.amazonaws.com',
  ruta: '/test.txt',
  region: 'us-east-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  fecha: new Date('2013-05-24T00:00:00.000Z'),
  segundos: 86400,
  resumenCanonico: '3bfa292879f6447bbcda7001decf97f4a54dc650c8942174ae0a9121cf58ad04',
};

// Las partes de la cadena a firmar van separadas por un salto de linea
const SALTO = '\n';

const hmac = (clave: Buffer | string, dato: string) =>
  createHmac('sha256', clave).update(dato, 'utf8').digest();

describe('firmarConsultaS3', () => {
  /**
   * Se firma el resumen que AWS documenta para este ejemplo y se compara con lo
   * que sale de nuestra implementacion: si coinciden, la peticion canonica que
   * armamos es la que espera S3 y la cadena de claves tambien.
   */
  it('firma lo mismo que el ejemplo oficial de AWS', () => {
    const { host, ruta, region, accessKeyId, secretAccessKey, fecha, segundos } = EJEMPLO_AWS;
    const ambito = `20130524/${region}/s3/aws4_request`;
    const claveDeFirma = hmac(
      hmac(hmac(hmac(`AWS4${secretAccessKey}`, '20130524'), region), 's3'),
      'aws4_request'
    );
    const esperada = createHmac('sha256', claveDeFirma)
      .update(
        ['AWS4-HMAC-SHA256', '20130524T000000Z', ambito, EJEMPLO_AWS.resumenCanonico].join(SALTO),
        'utf8'
      )
      .digest('hex');

    const url = firmarConsultaS3({
      metodo: 'GET',
      host,
      ruta,
      region,
      accessKeyId,
      secretAccessKey,
      fecha,
      segundos,
    });

    expect(parametros(url).get('X-Amz-Signature')).toBe(esperada);
  });
});

describe('enlaces firmados de R2', () => {
  it('apunta al bucket de la cuenta con la ruta del archivo', () => {
    const url = new URL(almacen().urlDeLectura('cursos/01a0/parte-1.mp4', UNA_HORA));

    expect(url.host).toBe('0ab1cd2ef3.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/hycon-videos/cursos/01a0/parte-1.mp4');
  });

  it('lleva el algoritmo, la credencial del dia y la caducidad', () => {
    const consulta = parametros(almacen().urlDeLectura('cursos/a.mp4', UNA_HORA));

    expect(consulta.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(consulta.get('X-Amz-Credential')).toBe('clave-de-acceso/20261016/auto/s3/aws4_request');
    expect(consulta.get('X-Amz-Date')).toBe('20261016T120000Z');
    expect(consulta.get('X-Amz-Expires')).toBe('3600');
    expect(consulta.get('X-Amz-SignedHeaders')).toBe('host');
  });

  // El secreto se usa para firmar, pero nunca puede aparecer en el enlace
  it('no expone el secreto', () => {
    const url = almacen().urlDeSubida('cursos/a.mp4', UNA_HORA);

    expect(url).not.toContain(CONFIG.secretAccessKey);
  });

  it('cada metodo tiene su propia firma', () => {
    const lectura = parametros(almacen().urlDeLectura('cursos/a.mp4', UNA_HORA));
    const subida = parametros(almacen().urlDeSubida('cursos/a.mp4', UNA_HORA));

    expect(subida.get('X-Amz-Signature')).not.toBe(lectura.get('X-Amz-Signature'));
  });

  it('la caducidad cambia la firma', () => {
    const corta = parametros(almacen().urlDeLectura('cursos/a.mp4', 60));
    const larga = parametros(almacen().urlDeLectura('cursos/a.mp4', UNA_HORA));

    expect(corta.get('X-Amz-Signature')).not.toBe(larga.get('X-Amz-Signature'));
  });

  it('firma dos veces lo mismo igual', () => {
    expect(almacen().urlDeLectura('cursos/a.mp4', UNA_HORA)).toBe(
      almacen().urlDeLectura('cursos/a.mp4', UNA_HORA)
    );
  });
});

describe('claveNueva', () => {
  it('agrupa por curso dentro de la carpeta configurada', () => {
    expect(almacen().claveNueva('01a0-fef2', 'nombre-unico', 'mp4')).toBe(
      'cursos/01a0-fef2/nombre-unico.mp4'
    );
  });
});

describe('eliminar', () => {
  afterEach(() => vi.unstubAllGlobals());

  const responder = (status: number) => {
    const falso = vi.fn().mockResolvedValue({ ok: status < 400, status });
    vi.stubGlobal('fetch', falso);
    return falso;
  };

  it('borra con un DELETE firmado', async () => {
    const falso = responder(204);

    await almacen().eliminar('cursos/a.mp4');

    const [url, opciones] = falso.mock.calls[0] as [string, RequestInit];
    expect(opciones.method).toBe('DELETE');
    expect(url).toContain('/hycon-videos/cursos/a.mp4');
  });

  // Si el archivo ya no estaba, el resultado es el que se buscaba
  it('un 404 no es un error', async () => {
    responder(404);

    await expect(almacen().eliminar('cursos/a.mp4')).resolves.toBeUndefined();
  });

  it('avisa cuando R2 responde mal', async () => {
    responder(500);

    await expect(almacen().eliminar('cursos/a.mp4')).rejects.toMatchObject({ statusCode: 502 });
  });
});
