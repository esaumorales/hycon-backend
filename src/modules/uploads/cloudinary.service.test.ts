import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { crearAlmacenCloudinary } from './cloudinary.service';

const config = {
  cloudName: 'hycon-demo',
  apiKey: '123456789012345',
  apiSecret: 'secreto-de-prueba',
  carpeta: 'hycon',
};

const almacen = crearAlmacenCloudinary(config);
const URL_SUYA =
  'https://res.cloudinary.com/hycon-demo/image/upload/v1760000000/hycon/catalogo/abc123.webp';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('firma de subida', () => {
  it('firma con los parametros ordenados y el secreto al final', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T12:00:00.000Z'));

    const firma = almacen.firmarSubida('catalogo');
    const esperada = createHash('sha1')
      .update(`folder=hycon/catalogo&timestamp=${firma.timestamp}${config.apiSecret}`)
      .digest('hex');

    expect(firma.signature).toBe(esperada);
    expect(firma).toMatchObject({
      cloudName: 'hycon-demo',
      apiKey: config.apiKey,
      folder: 'hycon/catalogo',
    });
  });

  it('el secreto nunca viaja en la firma', () => {
    expect(JSON.stringify(almacen.firmarSubida('avatares'))).not.toContain(config.apiSecret);
  });

  it('cada destino tiene su carpeta', () => {
    expect(almacen.firmarSubida('avatares').folder).toBe('hycon/avatares');
    expect(almacen.firmarSubida('catalogo').folder).toBe('hycon/catalogo');
  });

  it('el momento de la firma es en segundos, como lo espera Cloudinary', () => {
    const firma = almacen.firmarSubida('catalogo');

    expect(Number.isInteger(firma.timestamp)).toBe(true);
    expect(Math.abs(firma.timestamp - Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(2);
  });
});

describe('reconocer sus propias imagenes', () => {
  it('distingue las suyas de las que estan en disco', () => {
    expect(almacen.esSuya(URL_SUYA)).toBe(true);
    expect(almacen.esSuya('http://localhost:4000/uploads/imagenes/abc.jpg')).toBe(false);
    expect(almacen.esSuya('https://images.unsplash.com/photo-1.jpg')).toBe(false);
  });

  it('saca el identificador quitando la version y la extension', () => {
    expect(almacen.publicIdDe(URL_SUYA)).toBe('hycon/catalogo/abc123');
    expect(
      almacen.publicIdDe(
        'https://res.cloudinary.com/hycon-demo/image/upload/hycon/avatares/foto.png'
      )
    ).toBe('hycon/avatares/foto');
  });

  it('una URL ajena no tiene identificador', () => {
    expect(almacen.publicIdDe('https://images.unsplash.com/photo-1.jpg')).toBeNull();
    expect(almacen.publicIdDe('http://localhost:4000/uploads/imagenes/abc.jpg')).toBeNull();
  });
});

describe('borrar la imagen anterior', () => {
  it('pide el borrado firmado del identificador correcto', async () => {
    const peticion = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', peticion);

    await almacen.eliminar(URL_SUYA);

    const [url, opciones] = peticion.mock.calls[0];
    const cuerpo = Object.fromEntries((opciones.body as URLSearchParams).entries());
    expect(url).toBe('https://api.cloudinary.com/v1_1/hycon-demo/image/destroy');
    expect(cuerpo.public_id).toBe('hycon/catalogo/abc123');
    expect(cuerpo.api_key).toBe(config.apiKey);
    expect(cuerpo.signature).toHaveLength(40);
    // El secreto se usa para firmar, pero no se envia
    expect(JSON.stringify(cuerpo)).not.toContain(config.apiSecret);
  });

  it('una URL que no es suya no genera ninguna llamada', async () => {
    const peticion = vi.fn();
    vi.stubGlobal('fetch', peticion);

    await almacen.eliminar('https://images.unsplash.com/photo-1.jpg');

    expect(peticion).not.toHaveBeenCalled();
  });

  it('si Cloudinary responde mal, se avisa con un error claro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(almacen.eliminar(URL_SUYA)).rejects.toMatchObject({ statusCode: 502 });
  });
});
