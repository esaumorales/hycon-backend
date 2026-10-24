import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAlmacenStream } from './stream.service';

const CONFIG = {
  accountId: 'cuenta-123',
  apiToken: 'token-secreto',
  dominio: 'customer-abc.cloudflarestream.com',
};

const UID = 'ea95132c15732412d22c1476fa83f27a';
const BASE = 'https://api.cloudflare.com/client/v4/accounts/cuenta-123/stream';

// El reloj se queda quieto para poder comprobar la caducidad del token
let ahora = new Date('2026-10-16T12:00:00.000Z').getTime();
const almacen = () => crearAlmacenStream(CONFIG, () => ahora);

const responder = (resultado: unknown, status = 200) =>
  vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => (status < 400 ? { success: true, result: resultado } : resultado),
  });

const ultimaLlamada = (falso: ReturnType<typeof vi.fn>, indice = 0) =>
  falso.mock.calls[indice] as [string, RequestInit];

describe('subida a Cloudflare Stream', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pide un destino de un solo uso con la duracion maxima', async () => {
    const falso = responder({ uploadURL: 'https://upload.stream/xyz', uid: UID });
    vi.stubGlobal('fetch', falso);

    const subida = await almacen().urlDeSubida(1800);

    expect(subida).toEqual({ url: 'https://upload.stream/xyz', uid: UID });
    const [url, opciones] = ultimaLlamada(falso);
    expect(url).toBe(`${BASE}/direct_upload`);
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(String(opciones.body))).toEqual({
      maxDurationSeconds: 1800,
      requireSignedURLs: true,
    });
  });

  it('manda el token de la cuenta en la cabecera, nunca en la URL', async () => {
    const falso = responder({ uploadURL: 'https://upload.stream/xyz', uid: UID });
    vi.stubGlobal('fetch', falso);

    await almacen().urlDeSubida(60);

    const [url, opciones] = ultimaLlamada(falso);
    const cabeceras = opciones.headers as Record<string, string>;
    expect(cabeceras.Authorization).toBe('Bearer token-secreto');
    expect(url).not.toContain('token-secreto');
  });

  it('traduce el motivo cuando Cloudflare rechaza la peticion', async () => {
    vi.stubGlobal('fetch', responder({ success: false, errors: [{ message: 'Token sin permiso' }] }, 403));

    await expect(almacen().urlDeSubida(60)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Token sin permiso',
    });
  });
});

describe('reproduccion firmada', () => {
  let falso: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ahora = new Date('2026-10-16T12:00:00.000Z').getTime();
    falso = responder({ token: 'token-del-video' });
    vi.stubGlobal('fetch', falso);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('devuelve el reproductor con el token dentro', async () => {
    const url = await almacen().urlDeReproduccion(UID, 7200);

    expect(url).toBe('https://customer-abc.cloudflarestream.com/token-del-video/iframe');
    const [destino, opciones] = ultimaLlamada(falso);
    expect(destino).toBe(`${BASE}/${UID}/token`);
    expect(JSON.parse(String(opciones.body))).toEqual({
      exp: Math.floor(ahora / 1000) + 7200,
    });
  });

  // Pedir un token por cada reproduccion seria una llamada de mas en cada vista
  it('reutiliza el token mientras siga vigente', async () => {
    const stream = almacen();

    await stream.urlDeReproduccion(UID, 7200);
    await stream.urlDeReproduccion(UID, 7200);

    expect(falso).toHaveBeenCalledTimes(1);
  });

  it('cuando el token esta por caducar pide otro', async () => {
    const stream = almacen();
    await stream.urlDeReproduccion(UID, 120);

    // Se avanza hasta el margen de seguridad previo a la caducidad
    ahora += 100_000;
    await stream.urlDeReproduccion(UID, 120);

    expect(falso).toHaveBeenCalledTimes(2);
  });

  it('cada video tiene su propio token', async () => {
    const stream = almacen();
    const otro = 'bb95132c15732412d22c1476fa83f27b';

    await stream.urlDeReproduccion(UID, 7200);
    await stream.urlDeReproduccion(otro, 7200);

    expect(falso).toHaveBeenCalledTimes(2);
  });
});

describe('eliminar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('borra el video de la cuenta', async () => {
    const falso = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', falso);

    await almacen().eliminar(UID);

    const [url, opciones] = ultimaLlamada(falso);
    expect(url).toBe(`${BASE}/${UID}`);
    expect(opciones.method).toBe('DELETE');
  });

  it('si ya no estaba, no es un error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(almacen().eliminar(UID)).resolves.toBeUndefined();
  });

  it('avisa si Cloudflare responde mal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(almacen().eliminar(UID)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('al borrar deja de servir el token que tenia guardado', async () => {
    const stream = almacen();
    vi.stubGlobal('fetch', responder({ token: 'token-del-video' }));
    await stream.urlDeReproduccion(UID, 7200);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await stream.eliminar(UID);

    const pedirDeNuevo = responder({ token: 'token-nuevo' });
    vi.stubGlobal('fetch', pedirDeNuevo);
    await expect(stream.urlDeReproduccion(UID, 7200)).resolves.toContain('token-nuevo');
  });
});
