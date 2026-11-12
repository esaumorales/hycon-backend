import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { crearAlmacenImagenes, detectarTipoImagen, TAMANO_MAXIMO_IMAGEN } from './uploads.service';

// Firmas minimas de cada formato; el resto del contenido no importa para detectarlo
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary');
const GIF = Buffer.from('GIF89a', 'binary');

describe('detectarTipoImagen', () => {
  it('reconoce jpg, png, webp y gif por su firma', () => {
    expect(detectarTipoImagen(JPG)).toBe('jpg');
    expect(detectarTipoImagen(PNG)).toBe('png');
    expect(detectarTipoImagen(WEBP)).toBe('webp');
    expect(detectarTipoImagen(GIF)).toBe('gif');
  });

  it('rechaza texto disfrazado de imagen', () => {
    expect(detectarTipoImagen(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
  });

  it('no confunde un RIFF de audio con webp', () => {
    expect(detectarTipoImagen(Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'binary'))).toBeNull();
  });

  it('no falla con archivos mas cortos que la firma', () => {
    expect(detectarTipoImagen(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe('almacen de imagenes', () => {
  let carpeta: string;
  const urlPublica = 'http://localhost:4000';

  beforeAll(() => {
    carpeta = mkdtempSync(path.join(tmpdir(), 'hycon-uploads-'));
  });

  afterAll(() => {
    rmSync(carpeta, { recursive: true, force: true });
  });

  it('guarda con nombre aleatorio y devuelve una URL publica servible', async () => {
    const almacen = crearAlmacenImagenes({ carpetaRaiz: carpeta, urlPublica });

    const { url, tipo } = await almacen.guardar(PNG);

    expect(tipo).toBe('png');
    expect(url).toMatch(/^http:\/\/localhost:4000\/uploads\/imagenes\/[0-9a-f-]{36}\.png$/);
    expect(existsSync(almacen.rutaLocalDe(url) as string)).toBe(true);
  });

  it('rechaza archivos vacios, demasiado grandes o que no son imagen', async () => {
    const almacen = crearAlmacenImagenes({ carpetaRaiz: carpeta, urlPublica });

    await expect(almacen.guardar(Buffer.alloc(0))).rejects.toMatchObject({ statusCode: 422 });
    await expect(almacen.guardar(Buffer.from('hola'))).rejects.toMatchObject({ statusCode: 415 });

    const enorme = Buffer.concat([PNG, Buffer.alloc(TAMANO_MAXIMO_IMAGEN)]);
    await expect(almacen.guardar(enorme)).rejects.toMatchObject({ statusCode: 413 });
  });

  it('elimina un archivo propio', async () => {
    const almacen = crearAlmacenImagenes({ carpetaRaiz: carpeta, urlPublica });
    const { url } = await almacen.guardar(JPG);

    expect(await almacen.eliminar(url)).toBe(true);
    expect(existsSync(almacen.rutaLocalDe(url) as string)).toBe(false);
  });

  it('nunca toca URLs externas ni rutas con ../', async () => {
    const almacen = crearAlmacenImagenes({ carpetaRaiz: carpeta, urlPublica });

    expect(almacen.rutaLocalDe('https://cdn.hycon.lat/caja.webp')).toBeNull();
    expect(almacen.rutaLocalDe(`${urlPublica}/uploads/imagenes/../../.env`)).toBeNull();
    expect(await almacen.eliminar('https://cdn.hycon.lat/caja.webp')).toBe(false);
  });

  it('no falla si el archivo ya no existe', async () => {
    const almacen = crearAlmacenImagenes({ carpetaRaiz: carpeta, urlPublica });
    expect(await almacen.eliminar(`${urlPublica}/uploads/imagenes/no-existe.png`)).toBe(false);
  });
});
