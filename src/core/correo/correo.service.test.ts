import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearCorreo } from './correo.service';

const CONFIG = { apiKey: 'clave-de-resend', remitente: 'Hycon <no-responder@hycon.lat>' };

const mensaje = {
  para: 'ana@empresa.com',
  asunto: 'Recibimos tu solicitud',
  texto: 'Hola Ana',
};

const responder = (status: number) => {
  const falso = vi.fn().mockResolvedValue({ ok: status < 400, status });
  vi.stubGlobal('fetch', falso);
  return falso;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('correo saliente', () => {
  it('manda el mensaje con la clave en la cabecera, nunca en la URL', async () => {
    const falso = responder(200);

    await expect(crearCorreo(CONFIG).enviar(mensaje)).resolves.toBe(true);

    const [url, opciones] = falso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((opciones.headers as Record<string, string>).Authorization).toBe('Bearer clave-de-resend');
    expect(url).not.toContain('clave-de-resend');
  });

  it('envia el remitente, el destinatario y el texto', async () => {
    const falso = responder(200);

    await crearCorreo(CONFIG).enviar({ ...mensaje, responderA: 'info@hycon.lat' });

    const cuerpo = JSON.parse(String((falso.mock.calls[0] as [string, RequestInit])[1].body));
    expect(cuerpo).toEqual({
      from: 'Hycon <no-responder@hycon.lat>',
      to: ['ana@empresa.com'],
      subject: 'Recibimos tu solicitud',
      text: 'Hola Ana',
      reply_to: 'info@hycon.lat',
    });
  });

  it('sin direccion de respuesta no manda ese campo', async () => {
    const falso = responder(200);

    await crearCorreo(CONFIG).enviar(mensaje);

    const cuerpo = JSON.parse(String((falso.mock.calls[0] as [string, RequestInit])[1].body));
    expect(cuerpo).not.toHaveProperty('reply_to');
  });

  // Sin claves el servidor sigue funcionando: simplemente no sale ningun correo
  it('sin configurar no intenta enviar nada', async () => {
    const falso = responder(200);
    const correo = crearCorreo({ apiKey: '', remitente: '' });

    expect(correo.configurado).toBe(false);
    await expect(correo.enviar(mensaje)).resolves.toBe(false);
    expect(falso).not.toHaveBeenCalled();
  });

  it('falta el remitente y tampoco se envia', async () => {
    expect(crearCorreo({ apiKey: 'clave', remitente: '' }).configurado).toBe(false);
  });

  // Un fallo del proveedor nunca puede tumbar lo que lo pidio
  it('si Resend responde mal devuelve false en vez de lanzar', async () => {
    responder(422);

    await expect(crearCorreo(CONFIG).enviar(mensaje)).resolves.toBe(false);
  });

  it('si no hay red devuelve false en vez de lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(crearCorreo(CONFIG).enviar(mensaje)).resolves.toBe(false);
  });
});

describe('el correo de la aplicacion', () => {
  // Con las claves en el .env, una corrida de pruebas mandaria correos de verdad
  it('queda desactivado mientras corren las pruebas', async () => {
    const { correo } = await import('./correo.service');

    expect(correo.configurado).toBe(false);
  });
});
