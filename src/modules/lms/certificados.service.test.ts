import { describe, expect, it, vi } from 'vitest';
import {
  certificadoSchema,
  codigoDeCertificado,
  crearServicioCertificados,
  type CertificadoBase,
  type DependenciasCertificados,
  type LeccionBase,
} from './certificados.service';

const CURSO = 'b7b299d8-ee8f-4bea-a618-0a5f8261136f';
const USUARIO = 7;

const curso = { courseId: 3, name: 'Mejora continua en operaciones', durationMinutes: 33 };

const parte = (lessonId: number, position: number): LeccionBase => ({
  lessonId,
  uuid: `0000000${lessonId}-0000-4000-8000-000000000001`,
  title: `Parte ${position}`,
  position,
});

const PARTES = [parte(11, 1), parte(12, 2), parte(13, 3)];

const certificado: CertificadoBase = {
  certificateCode: 'HY-ABCD1234',
  holderName: 'Ana Quispe Flores',
  issuedAt: new Date('2026-11-04T12:00:00.000Z'),
};

const crearDeps = (cambios: Partial<DependenciasCertificados> = {}): DependenciasCertificados => ({
  buscarCurso: vi.fn().mockResolvedValue(curso),
  comproElCurso: vi.fn().mockResolvedValue(true),
  listarPartes: vi.fn().mockResolvedValue(PARTES),
  partesVistas: vi.fn().mockResolvedValue([]),
  marcarVista: vi.fn().mockResolvedValue(undefined),
  certificadoDe: vi.fn().mockResolvedValue(null),
  emitir: vi.fn(async (datos) => ({
    certificateCode: datos.certificateCode,
    holderName: datos.holderName,
    issuedAt: new Date('2026-11-04T12:00:00.000Z'),
  })),
  ...cambios,
});

const servicio = (cambios: Partial<DependenciasCertificados> = {}) =>
  crearServicioCertificados(crearDeps(cambios));

describe('progreso del curso', () => {
  it('sin ver nada, ninguna parte esta marcada', async () => {
    const progreso = await servicio().progreso(CURSO, USUARIO);

    expect(progreso).toMatchObject({ vistas: 0, total: 3, completado: false, certificado: null });
    expect(progreso.partes.every((parte) => !parte.vista)).toBe(true);
  });

  it('marca las partes que el usuario ya vio', async () => {
    const progreso = await servicio({ partesVistas: vi.fn().mockResolvedValue([11, 13]) }).progreso(
      CURSO,
      USUARIO
    );

    expect(progreso.vistas).toBe(2);
    expect(progreso.partes.map((parte) => parte.vista)).toEqual([true, false, true]);
    expect(progreso.completado).toBe(false);
  });

  it('con todas vistas el curso queda terminado', async () => {
    const progreso = await servicio({
      partesVistas: vi.fn().mockResolvedValue([11, 12, 13]),
    }).progreso(CURSO, USUARIO);

    expect(progreso.completado).toBe(true);
  });

  // Un curso al que todavia no le cargaron contenido no se puede terminar
  it('un curso sin partes nunca esta completado', async () => {
    const progreso = await servicio({ listarPartes: vi.fn().mockResolvedValue([]) }).progreso(
      CURSO,
      USUARIO
    );

    expect(progreso).toMatchObject({ total: 0, completado: false });
  });

  it('un curso que no existe responde 404', async () => {
    await expect(
      servicio({ buscarCurso: vi.fn().mockResolvedValue(null) }).progreso(CURSO, USUARIO)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // El progreso es de quien compro el curso, de nadie mas
  it('sin haber comprado el curso no se ve el progreso', async () => {
    await expect(
      servicio({ comproElCurso: vi.fn().mockResolvedValue(false) }).progreso(CURSO, USUARIO)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('marcar una parte como vista', () => {
  it('guarda la marca y devuelve el progreso al dia', async () => {
    const deps = crearDeps();
    deps.partesVistas = vi.fn().mockResolvedValue([11]);

    const progreso = await crearServicioCertificados(deps).marcarVista(
      CURSO,
      PARTES[0].uuid,
      USUARIO
    );

    expect(deps.marcarVista).toHaveBeenCalledWith(USUARIO, 11);
    expect(progreso.vistas).toBe(1);
  });

  it('una parte de otro curso no se puede marcar', async () => {
    await expect(
      servicio().marcarVista(CURSO, '99999999-0000-4000-8000-000000000001', USUARIO)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('sin haber comprado el curso no se marca nada', async () => {
    const deps = crearDeps({ comproElCurso: vi.fn().mockResolvedValue(false) });

    await expect(
      crearServicioCertificados(deps).marcarVista(CURSO, PARTES[0].uuid, USUARIO)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(deps.marcarVista).not.toHaveBeenCalled();
  });
});

describe('emitir el certificado', () => {
  const completado = { partesVistas: vi.fn().mockResolvedValue([11, 12, 13]) };
  const datos = { nombre: 'Ana Quispe Flores' };

  it('lo emite con el nombre confirmado y los datos del curso', async () => {
    const emitido = await servicio(completado).emitir(CURSO, USUARIO, datos);

    expect(emitido).toMatchObject({
      nombre: 'Ana Quispe Flores',
      curso: 'Mejora continua en operaciones',
      duracionMinutos: 33,
    });
    expect(emitido.codigo).toMatch(/^HY-[0-9A-F]{8}$/);
  });

  // La regla que pidio el usuario: se confirma una vez y queda fijo
  it('no se emite dos veces: el nombre ya no se puede cambiar', async () => {
    const deps = crearDeps({ ...completado, certificadoDe: vi.fn().mockResolvedValue(certificado) });

    await expect(
      crearServicioCertificados(deps).emitir(CURSO, USUARIO, { nombre: 'Otro Nombre' })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(deps.emitir).not.toHaveBeenCalled();
  });

  it('sin terminar el curso no hay certificado', async () => {
    const deps = crearDeps({ partesVistas: vi.fn().mockResolvedValue([11, 12]) });

    await expect(
      crearServicioCertificados(deps).emitir(CURSO, USUARIO, datos)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(deps.emitir).not.toHaveBeenCalled();
  });

  it('un curso sin partes tampoco da certificado', async () => {
    const deps = crearDeps({ listarPartes: vi.fn().mockResolvedValue([]) });

    await expect(
      crearServicioCertificados(deps).emitir(CURSO, USUARIO, datos)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('sin haber comprado el curso no se emite', async () => {
    const deps = crearDeps({ ...completado, comproElCurso: vi.fn().mockResolvedValue(false) });

    await expect(
      crearServicioCertificados(deps).emitir(CURSO, USUARIO, datos)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('el certificado ya emitido viaja con el progreso', async () => {
    const progreso = await servicio({
      ...completado,
      certificadoDe: vi.fn().mockResolvedValue(certificado),
    }).progreso(CURSO, USUARIO);

    expect(progreso.certificado).toMatchObject({
      codigo: 'HY-ABCD1234',
      nombre: 'Ana Quispe Flores',
      curso: 'Mejora continua en operaciones',
    });
  });
});

describe('nombre del certificado', () => {
  const valido = (nombre: string) => certificadoSchema.safeParse({ nombre }).success;

  it('acepta nombres con acentos, apostrofes y guiones', () => {
    expect(valido('Ana Quispe Flores')).toBe(true);
    expect(valido('José Pérez')).toBe(true);
    expect(valido("Mary O'Brien")).toBe(true);
    expect(valido('Ana María Rojas-Luna')).toBe(true);
  });

  // Va impreso en un documento: no entra cualquier cosa
  it('rechaza lo que no es un nombre', () => {
    expect(valido('A')).toBe(false);
    expect(valido('<script>alert(1)</script>')).toBe(false);
    expect(valido('Ana 123')).toBe(false);
    expect(valido('x'.repeat(121))).toBe(false);
  });

  it('recorta los espacios de los extremos', () => {
    const resultado = certificadoSchema.safeParse({ nombre: '  Ana Quispe  ' });

    expect(resultado.success && resultado.data.nombre).toBe('Ana Quispe');
  });
});

describe('codigo del certificado', () => {
  it('tiene el prefijo de la marca y no se repite', () => {
    const primero = codigoDeCertificado();
    const segundo = codigoDeCertificado();

    expect(primero).toMatch(/^HY-[0-9A-F]{8}$/);
    expect(primero).not.toBe(segundo);
  });
});
