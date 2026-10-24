import { describe, expect, it, vi } from 'vitest';
import { crearAlmacenVideos, extensionDe, type DependenciasVideos } from './videos.service';

const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const UID_STREAM = 'ea95132c15732412d22c1476fa83f27a';
const CURSO = '01a0fef2-19c0-70bf-a4e4-2e1a85443aef';

const r2Falso = () => ({
  claveNueva: vi.fn((cursoUuid: string, nombre: string, extension: string) =>
    `cursos/${cursoUuid}/${nombre}.${extension}`
  ),
  urlDeLectura: vi.fn((clave: string) => `https://bucket/${clave}?firma=lectura`),
  urlDeSubida: vi.fn((clave: string) => `https://bucket/${clave}?firma=subida`),
  eliminar: vi.fn().mockResolvedValue(undefined),
});

const streamFalso = () => ({
  urlDeSubida: vi.fn().mockResolvedValue({ url: 'https://upload.stream/abc', uid: UID_STREAM }),
  urlDeReproduccion: vi.fn().mockResolvedValue('https://videos.hycon/token/iframe'),
  eliminar: vi.fn().mockResolvedValue(undefined),
});

const crear = (cambios: Partial<DependenciasVideos> = {}) =>
  crearAlmacenVideos({
    proveedor: 'youtube',
    r2: null,
    stream: null,
    firmaSegundos: 3600,
    maximoMinutos: 240,
    nombreNuevo: () => 'nombre-unico',
    ...cambios,
  } as DependenciasVideos);

describe('extensionDe', () => {
  it('acepta los formatos que el navegador reproduce', () => {
    expect(extensionDe('clase-1.mp4')).toBe('mp4');
    expect(extensionDe('CLASE.MP4')).toBe('mp4');
    expect(extensionDe('clase.webm')).toBe('webm');
  });

  it('rechaza lo que no es video', () => {
    expect(extensionDe('clase.exe')).toBeNull();
    expect(extensionDe('clase.mp4.exe')).toBeNull();
    expect(extensionDe('sin-extension')).toBeNull();
  });
});

describe('reproducir', () => {
  it('un enlace de YouTube sale con su id listo para incrustar', async () => {
    await expect(crear().reproducir(YOUTUBE)).resolves.toEqual({
      tipo: 'youtube',
      url: YOUTUBE,
      youtubeId: 'dQw4w9WgXcQ',
    });
  });

  it('un archivo de R2 sale con un enlace firmado', async () => {
    const r2 = r2Falso();

    const reproduccion = await crear({ proveedor: 'r2', r2 }).reproducir('r2:cursos/a/parte-1.mp4');

    expect(reproduccion).toEqual({
      tipo: 'archivo',
      url: 'https://bucket/cursos/a/parte-1.mp4?firma=lectura',
      youtubeId: null,
    });
    expect(r2.urlDeLectura).toHaveBeenCalledWith('cursos/a/parte-1.mp4', 3600);
  });

  it('un video de Stream sale con el reproductor firmado', async () => {
    const stream = streamFalso();

    const reproduccion = await crear({ proveedor: 'stream', stream }).reproducir(
      `stream:${UID_STREAM}`
    );

    expect(reproduccion).toEqual({
      tipo: 'incrustado',
      url: 'https://videos.hycon/token/iframe',
      youtubeId: null,
    });
    expect(stream.urlDeReproduccion).toHaveBeenCalledWith(UID_STREAM, 3600);
  });

  it('sin video o con un valor que no se puede reproducir devuelve nada', async () => {
    await expect(crear().reproducir(null)).resolves.toBeNull();
    await expect(crear().reproducir('https://vimeo.com/1')).resolves.toBeNull();
  });

  /**
   * Lo importante del diseño: el video se sirve desde donde esta guardado y no
   * desde el proveedor configurado, asi cambiar de almacen no apaga lo anterior.
   */
  it('con Stream configurado los videos antiguos de R2 y YouTube siguen saliendo', async () => {
    const almacen = crear({ proveedor: 'stream', stream: streamFalso(), r2: r2Falso() });

    await expect(almacen.reproducir('r2:cursos/a/vieja.mp4')).resolves.toMatchObject({
      tipo: 'archivo',
    });
    await expect(almacen.reproducir(YOUTUBE)).resolves.toMatchObject({ tipo: 'youtube' });
  });

  it('avisa si hay un video de R2 pero el almacen no esta configurado', async () => {
    await expect(crear().reproducir('r2:cursos/a/parte-1.mp4')).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});

describe('firmarSubida', () => {
  it('con youtube no hay donde subir y se dice claro', async () => {
    const almacen = crear();

    expect(almacen.aceptaSubidas).toBe(false);
    await expect(almacen.firmarSubida(CURSO, 'clase.mp4')).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('R2 devuelve un PUT firmado y la referencia que hay que guardar', async () => {
    const almacen = crear({ proveedor: 'r2', r2: r2Falso() });

    const subida = await almacen.firmarSubida(CURSO, 'Clase 1.mp4');

    expect(almacen.aceptaSubidas).toBe(true);
    expect(subida).toEqual({
      proveedor: 'r2',
      metodo: 'PUT',
      url: `https://bucket/cursos/${CURSO}/nombre-unico.mp4?firma=subida`,
      referencia: `r2:cursos/${CURSO}/nombre-unico.mp4`,
      campoArchivo: null,
    });
  });

  // El nombre que llega del navegador no decide nada: solo se mira la extension
  it('R2 rechaza un archivo que no es video', async () => {
    const almacen = crear({ proveedor: 'r2', r2: r2Falso() });

    await expect(almacen.firmarSubida(CURSO, 'virus.exe')).rejects.toMatchObject({
      statusCode: 415,
    });
  });

  it('Stream devuelve un destino de un solo uso y su uid', async () => {
    const stream = streamFalso();

    const subida = await crear({ proveedor: 'stream', stream }).firmarSubida(CURSO, 'clase.mov');

    expect(subida).toEqual({
      proveedor: 'stream',
      metodo: 'POST',
      url: 'https://upload.stream/abc',
      referencia: `stream:${UID_STREAM}`,
      campoArchivo: 'file',
    });
    expect(stream.urlDeSubida).toHaveBeenCalledWith(240 * 60);
  });
});

describe('eliminar', () => {
  it('borra el archivo de R2', async () => {
    const r2 = r2Falso();

    await expect(crear({ proveedor: 'r2', r2 }).eliminar('r2:cursos/a/parte-1.mp4')).resolves.toBe(
      true
    );
    expect(r2.eliminar).toHaveBeenCalledWith('cursos/a/parte-1.mp4');
  });

  it('un enlace de YouTube no es nuestro y no se toca', async () => {
    await expect(crear().eliminar(YOUTUBE)).resolves.toBe(false);
  });

  // Limpiar es de mejor esfuerzo: un fallo no debe tumbar el guardado
  it('si el almacen falla devuelve false en vez de reventar', async () => {
    const r2 = r2Falso();
    r2.eliminar.mockRejectedValue(new Error('sin red'));

    await expect(crear({ proveedor: 'r2', r2 }).eliminar('r2:cursos/a/parte-1.mp4')).resolves.toBe(
      false
    );
  });
});
