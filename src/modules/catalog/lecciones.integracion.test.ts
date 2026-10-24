import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  crearServicioLecciones,
  type DependenciasLecciones,
  type LeccionBase,
} from './lecciones.service';
import { crearAlmacenVideos, type DependenciasVideos } from '../media/videos.service';
import { crearAlmacenR2 } from '../media/r2.service';
import { crearAlmacenStream } from '../media/stream.service';

/**
 * Pruebas de conjunto: el temario con el almacen de videos de verdad montado
 * detras. Nada sale a la red (firmar en R2 es solo criptografia) y lo que se
 * comprueba es lo que acaba viendo el navegador.
 */

const CURSO = 'b7b299d8-ee8f-4bea-a618-0a5f8261136f';
const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const UID_STREAM = 'ea95132c15732412d22c1476fa83f27a';

const CONFIG_R2 = {
  accountId: '0ab1cd2ef3',
  accessKeyId: 'clave-de-acceso',
  secretAccessKey: 'secreto-que-no-sale-de-aqui',
  bucket: 'hycon-videos',
  carpeta: 'cursos',
};

const CONFIG_STREAM = {
  accountId: 'cuenta-123',
  apiToken: 'token-secreto',
  dominio: 'customer-abc.cloudflarestream.com',
};

const RELOJ = () => new Date('2026-10-17T12:00:00.000Z');

const leccion = (cambios: Partial<LeccionBase> = {}): LeccionBase => ({
  uuid: '01a0fef2-0000-70bf-a4e4-000000000001',
  title: 'Qué es la ergonomía',
  description: null,
  videoUrl: 'r2:cursos/b7b2/parte-1.mp4',
  durationMinutes: 8,
  position: 1,
  isPreview: true,
  ...cambios,
});

const bloqueada = leccion({
  uuid: '01a0fef2-0000-70bf-a4e4-000000000002',
  title: 'Evaluación de puestos',
  videoUrl: 'r2:cursos/b7b2/parte-2-secreta.mp4',
  position: 2,
  isPreview: false,
});

const crearDeps = (lecciones: LeccionBase[], compro = false): DependenciasLecciones => ({
  buscarCurso: vi.fn().mockResolvedValue({ courseId: 3, previewSeconds: 60 }),
  listar: vi.fn().mockResolvedValue(lecciones),
  comproElCurso: vi.fn().mockResolvedValue(compro),
  crear: vi.fn(),
  actualizar: vi.fn(),
  eliminar: vi.fn(),
  quitarMuestras: vi.fn().mockResolvedValue(undefined),
  reordenar: vi.fn().mockResolvedValue(undefined),
  siguientePosicion: vi.fn().mockResolvedValue(1),
});

const crearVideos = (cambios: Partial<DependenciasVideos> = {}) =>
  crearAlmacenVideos({
    proveedor: 'r2',
    r2: crearAlmacenR2(CONFIG_R2, RELOJ),
    stream: null,
    firmaSegundos: 3600,
    maximoMinutos: 240,
    nombreNuevo: () => 'nombre-unico',
    ...cambios,
  } as DependenciasVideos);

const servicio = (lecciones: LeccionBase[], compro = false, videos = crearVideos()) =>
  crearServicioLecciones(crearDeps(lecciones, compro), videos);

describe('temario de un visitante con los videos en R2', () => {
  it('la muestra llega firmada y lista para reproducir', async () => {
    const { lecciones } = await servicio([leccion(), bloqueada]).listarPublicas(CURSO);

    expect(lecciones[0]).toMatchObject({ tipoVideo: 'archivo', bloqueada: false, limiteSegundos: 60 });
    const url = new URL(lecciones[0].videoUrl as string);
    expect(url.host).toBe('0ab1cd2ef3.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/hycon-videos/cursos/b7b2/parte-1.mp4');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  // La firma caduca sola: un enlace repartido deja de servir
  it('el enlace firmado caduca', async () => {
    const { lecciones } = await servicio([leccion()]).listarPublicas(CURSO);

    const url = new URL(lecciones[0].videoUrl as string);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261017T120000Z');
  });

  it('de lo que no ha comprado no sale nada que lleve al archivo', async () => {
    const temario = await servicio([leccion(), bloqueada]).listarPublicas(CURSO);

    expect(temario.lecciones[1]).toMatchObject({
      bloqueada: true,
      tipoVideo: null,
      videoUrl: null,
      youtubeId: null,
    });
    // Ni en la respuesta entera: ni la ruta del archivo ni una firma suelta
    const json = JSON.stringify(temario);
    expect(json).not.toContain('parte-2-secreta');
    expect(json).not.toContain('r2:');
  });

  it('el secreto de la cuenta nunca viaja al navegador', async () => {
    const temario = await servicio([leccion(), bloqueada]).listarPublicas(CURSO);

    expect(JSON.stringify(temario)).not.toContain(CONFIG_R2.secretAccessKey);
  });

  /**
   * Si alguien escribe a mano una referencia con saltos de carpeta, no se firma:
   * la parte sale sin video en vez de abrir la puerta a otro sitio del bucket.
   */
  it('una referencia manipulada no se firma', async () => {
    const trucada = leccion({ videoUrl: 'r2:../otro-bucket/privado.mp4' });

    const { lecciones } = await servicio([trucada]).listarPublicas(CURSO);

    expect(lecciones[0]).toMatchObject({ tipoVideo: null, videoUrl: null, bloqueada: false });
  });
});

describe('temario de quien ya compro', () => {
  it('todas las partes llegan firmadas y sin corte', async () => {
    const { lecciones, tieneAcceso } = await servicio([leccion(), bloqueada], true).listarPublicas(
      CURSO,
      7
    );

    expect(tieneAcceso).toBe(true);
    expect(lecciones.every((parte) => parte.tipoVideo === 'archivo')).toBe(true);
    expect(lecciones.every((parte) => parte.limiteSegundos === null)).toBe(true);
    expect(lecciones[1].videoUrl).toContain('parte-2-secreta.mp4');
  });

  // Cada parte se firma por separado: una firma no abre la siguiente
  it('cada parte tiene su propia firma', async () => {
    const { lecciones } = await servicio([leccion(), bloqueada], true).listarPublicas(CURSO, 7);

    const primera = new URL(lecciones[0].videoUrl as string).searchParams.get('X-Amz-Signature');
    const segunda = new URL(lecciones[1].videoUrl as string).searchParams.get('X-Amz-Signature');
    expect(primera).not.toBe(segunda);
  });
});

describe('el panel del administrador', () => {
  it('ve la referencia guardada ademas del enlace firmado', async () => {
    const { lecciones } = await servicio([leccion()]).listarParaAdmin(CURSO);

    expect(lecciones[0].referencia).toBe('r2:cursos/b7b2/parte-1.mp4');
    expect(lecciones[0].videoUrl).toContain('X-Amz-Signature');
  });
});

describe('convivencia de almacenes', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Lo que sostiene el cambio de proveedor: con Stream configurado, los videos
   * que ya estaban en R2 o en YouTube se siguen sirviendo desde donde estan.
   */
  it('con Stream configurado lo anterior sigue saliendo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, result: { token: 'token-del-video' } }),
      })
    );
    const videos = crearVideos({
      proveedor: 'stream',
      stream: crearAlmacenStream(CONFIG_STREAM, () => RELOJ().getTime()),
    });
    const partes = [
      leccion(),
      leccion({ uuid: 'b-2', videoUrl: YOUTUBE, isPreview: true }),
      leccion({ uuid: 'b-3', videoUrl: `stream:${UID_STREAM}`, isPreview: true }),
    ];

    const { lecciones } = await servicio(partes, true, videos).listarPublicas(CURSO, 7);

    expect(lecciones[0]).toMatchObject({ tipoVideo: 'archivo' });
    expect(lecciones[1]).toMatchObject({ tipoVideo: 'youtube', youtubeId: 'dQw4w9WgXcQ' });
    expect(lecciones[2]).toMatchObject({
      tipoVideo: 'incrustado',
      videoUrl: 'https://customer-abc.cloudflarestream.com/token-del-video/iframe',
    });
  });

  // Si se quitan las claves de R2, la parte sale sin video en lugar de dar error
  it('un video de un almacen que ya no esta configurado no tumba el temario', async () => {
    const videos = crearVideos({ proveedor: 'youtube', r2: null });
    const partes = [leccion(), leccion({ uuid: 'b-2', videoUrl: YOUTUBE, isPreview: true })];

    const { lecciones } = await servicio(partes, false, videos).listarPublicas(CURSO);

    expect(lecciones[0]).toMatchObject({ tipoVideo: null, videoUrl: null, bloqueada: false });
    expect(lecciones[1]).toMatchObject({ tipoVideo: 'youtube', youtubeId: 'dQw4w9WgXcQ' });
  });
});
