import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  crearAvisoCotizaciones,
  textoParaElCliente,
  textoParaElEquipo,
} from './cotizaciones.correo';
import type { Correo } from '../../core/correo/correo.service';
import type { CotizacionPublica } from './cotizaciones.service';

const EQUIPO = 'info@hycon.lat';

const cotizacion = (cambios: Partial<CotizacionPublica> = {}): CotizacionPublica => ({
  uuid: '0192f0aa-1111-7000-8000-5f3ad2c91e77',
  codigo: 'COT-C91E77',
  nombre: 'Ana Quispe',
  empresa: 'Logistica SAC',
  telefono: '902665565',
  correo: 'ana@empresa.com',
  mensaje: 'Tenemos 12 puestos en el almacen',
  evaluaciones: [
    {
      codigo: 'levantamiento-cargas',
      nombre: 'Levantamiento de cargas',
      norma: 'ISO 11228-1:2021',
      precio: 200,
    },
  ],
  total: 200,
  estado: 'nuevo',
  createdAt: '2026-11-04T12:00:00.000Z',
  ...cambios,
});

const correoFalso = (configurado = true) =>
  ({ configurado, enviar: vi.fn().mockResolvedValue(true) }) as unknown as Correo & {
    enviar: ReturnType<typeof vi.fn>;
  };

afterEach(() => vi.restoreAllMocks());

describe('texto para el equipo', () => {
  it('lleva los datos de contacto y el detalle de lo pedido', () => {
    const texto = textoParaElEquipo(cotizacion());

    expect(texto).toContain('COT-C91E77');
    expect(texto).toContain('Ana Quispe');
    expect(texto).toContain('Logistica SAC');
    expect(texto).toContain('902665565');
    expect(texto).toContain('ana@empresa.com');
    expect(texto).toContain('Levantamiento de cargas (ISO 11228-1:2021): S/ 200.00');
    expect(texto).toContain('Total referencial: S/ 200.00');
    expect(texto).toContain('Tenemos 12 puestos en el almacen');
  });

  it('dice que no hay empresa en vez de dejar un hueco', () => {
    const texto = textoParaElEquipo(cotizacion({ empresa: null }));

    expect(texto).toContain('Empresa: no indica');
  });

  it('sin mensaje lo dice igualmente', () => {
    expect(textoParaElEquipo(cotizacion({ mensaje: null }))).toContain('Sin mensaje adicional');
  });
});

describe('acuse para el cliente', () => {
  it('saluda por su nombre y repite lo que pidio con su codigo', () => {
    const texto = textoParaElCliente(cotizacion());

    expect(texto).toContain('Hola Ana Quispe');
    expect(texto).toContain('COT-C91E77');
    expect(texto).toContain('Levantamiento de cargas');
    expect(texto).toContain('Total referencial: S/ 200.00');
  });

  // El cliente no tiene por que ver lo que se anota para el equipo
  it('no le devuelve su propio telefono ni datos internos', () => {
    const texto = textoParaElCliente(cotizacion());

    expect(texto).not.toContain('902665565');
    expect(texto).not.toContain('Logistica SAC');
  });
});

describe('aviso de una cotizacion nueva', () => {
  it('manda dos correos: al equipo y al cliente', async () => {
    const correo = correoFalso();

    await crearAvisoCotizaciones(correo, EQUIPO).nueva(cotizacion());

    expect(correo.enviar).toHaveBeenCalledTimes(2);
    const [alEquipo, alCliente] = correo.enviar.mock.calls.map((llamada) => llamada[0]);
    expect(alEquipo.para).toBe(EQUIPO);
    expect(alCliente.para).toBe('ana@empresa.com');
  });

  // Contestar el aviso tiene que escribirle al cliente directamente
  it('el aviso del equipo responde al correo del cliente', async () => {
    const correo = correoFalso();

    await crearAvisoCotizaciones(correo, EQUIPO).nueva(cotizacion());

    expect(correo.enviar.mock.calls[0][0].responderA).toBe('ana@empresa.com');
    expect(correo.enviar.mock.calls[1][0].responderA).toBe(EQUIPO);
  });

  it('el asunto lleva el codigo para poder buscarlo', async () => {
    const correo = correoFalso();

    await crearAvisoCotizaciones(correo, EQUIPO).nueva(cotizacion());

    expect(correo.enviar.mock.calls[0][0].asunto).toContain('COT-C91E77');
    expect(correo.enviar.mock.calls[1][0].asunto).toContain('COT-C91E77');
  });

  // Sin correo configurado queda anotado el codigo, para poder recuperarla
  it('sin correo configurado avisa en el registro y no intenta enviar', async () => {
    const correo = correoFalso(false);
    const registro = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await crearAvisoCotizaciones(correo, EQUIPO).nueva(cotizacion());

    expect(correo.enviar).not.toHaveBeenCalled();
    expect(registro.mock.calls[0][0]).toContain('COT-C91E77');
  });

  it('sin buzon del equipo tampoco se envia', async () => {
    const correo = correoFalso();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await crearAvisoCotizaciones(correo, '').nueva(cotizacion());

    expect(correo.enviar).not.toHaveBeenCalled();
  });
});
