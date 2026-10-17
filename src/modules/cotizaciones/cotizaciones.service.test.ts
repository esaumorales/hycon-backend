import { describe, expect, it, vi } from 'vitest';
import {
  cotizacionSchema,
  crearServicioCotizaciones,
  type CotizacionBase,
  type DependenciasCotizaciones,
} from './cotizaciones.service';

const guardada = (total: number, evaluations: string[]): CotizacionBase => ({
  uuid: '0192f0aa-1111-7000-8000-5f3ad2c91e77',
  name: 'Ana Quispe',
  company: 'Logistica SAC',
  phone: '902665565',
  email: 'ana@empresa.com',
  message: null,
  evaluations,
  total: { toString: () => total.toFixed(2) },
  status: 'nuevo',
  createdAt: new Date('2026-10-16T12:00:00.000Z'),
});

const crearDeps = (): DependenciasCotizaciones => ({
  crear: vi.fn(async (datos) => guardada(datos.total, datos.evaluations)),
  listar: vi.fn().mockResolvedValue({ filas: [], total: 0 }),
});

const datos = {
  name: 'Ana Quispe',
  phone: '902665565',
  email: 'ana@empresa.com',
  evaluaciones: ['levantamiento-cargas'],
};

describe('catalogo de evaluaciones', () => {
  it('ofrece las cuatro evaluaciones con su norma y su precio', () => {
    const evaluaciones = crearServicioCotizaciones(crearDeps()).evaluaciones();

    expect(evaluaciones).toHaveLength(4);
    expect(evaluaciones).toContainEqual({
      codigo: 'movimientos-repetitivos',
      nombre: 'Movimientos repetitivos de miembros superiores',
      norma: 'ISO 11228-3:2026',
      precio: 250,
    });
    expect(evaluaciones.map((e) => e.precio)).toEqual([250, 200, 250, 200]);
  });
});

describe('crear una cotizacion', () => {
  it('suma el precio de lo pedido con sus propios precios', async () => {
    const deps = crearDeps();

    const cotizacion = await crearServicioCotizaciones(deps).crear({
      ...datos,
      evaluaciones: ['levantamiento-cargas', 'movimientos-repetitivos'],
    });

    // 200 + 250
    expect(cotizacion.total).toBe(450);
    expect(deps.crear).toHaveBeenCalledWith(expect.objectContaining({ total: 450 }));
  });

  it('las cuatro juntas cuestan 900', async () => {
    const servicio = crearServicioCotizaciones(crearDeps());

    const cotizacion = await servicio.crear({
      ...datos,
      evaluaciones: [
        'movimientos-repetitivos',
        'levantamiento-cargas',
        'empuje-traccion',
        'posturas-forzadas',
      ],
    });

    expect(cotizacion.total).toBe(900);
  });

  it('pedir dos veces la misma no la cobra doble', async () => {
    const servicio = crearServicioCotizaciones(crearDeps());

    const cotizacion = await servicio.crear({
      ...datos,
      evaluaciones: ['empuje-traccion', 'empuje-traccion'],
    });

    expect(cotizacion.total).toBe(250);
    expect(cotizacion.evaluaciones).toHaveLength(1);
  });

  it('devuelve cada evaluacion con su nombre y su norma, y un codigo corto', async () => {
    const servicio = crearServicioCotizaciones(crearDeps());

    const cotizacion = await servicio.crear({ ...datos, evaluaciones: ['posturas-forzadas'] });

    expect(cotizacion.codigo).toBe('COT-C91E77');
    expect(cotizacion.evaluaciones[0]).toMatchObject({
      nombre: 'Posturas forzadas',
      norma: 'ISO 11226:2000',
      precio: 200,
    });
    expect(cotizacion.estado).toBe('nuevo');
  });

  it('una evaluacion inventada no se cobra: responde 422', async () => {
    const deps = crearDeps();

    await expect(
      crearServicioCotizaciones(deps).crear({ ...datos, evaluaciones: ['masaje-gratis'] })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(deps.crear).not.toHaveBeenCalled();
  });
});

describe('validacion del formulario', () => {
  it('acepta una solicitud completa', () => {
    expect(cotizacionSchema.safeParse({ ...datos, company: 'Logistica SAC' }).success).toBe(true);
  });

  it('exige nombre, telefono, correo y al menos una evaluacion', () => {
    expect(cotizacionSchema.safeParse({ ...datos, name: 'A' }).success).toBe(false);
    expect(cotizacionSchema.safeParse({ ...datos, phone: '123' }).success).toBe(false);
    expect(cotizacionSchema.safeParse({ ...datos, email: 'no-es-correo' }).success).toBe(false);
    expect(cotizacionSchema.safeParse({ ...datos, evaluaciones: [] }).success).toBe(false);
  });

  it('el telefono no admite letras', () => {
    expect(cotizacionSchema.safeParse({ ...datos, phone: 'llamame' }).success).toBe(false);
    expect(cotizacionSchema.safeParse({ ...datos, phone: '+51 902 665 565' }).success).toBe(true);
  });

  it('el correo se guarda en minusculas', () => {
    const leido = cotizacionSchema.parse({ ...datos, email: 'Ana@Empresa.COM' });

    expect(leido.email).toBe('ana@empresa.com');
  });
});
