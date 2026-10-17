import { describe, expect, it, vi } from 'vitest';
import {
  crearServicioLecciones,
  type DependenciasLecciones,
  type LeccionBase,
} from './lecciones.service';

const CURSO = 'b7b299d8-ee8f-4bea-a618-0a5f8261136f';
const VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const leccion = (cambios: Partial<LeccionBase> = {}): LeccionBase => ({
  uuid: '01a0fef2-19c0-70bf-a4e4-2e1a85443aef',
  title: 'Introduccion',
  description: 'De que trata el curso',
  videoUrl: VIDEO,
  durationMinutes: 8,
  position: 1,
  isPreview: false,
  ...cambios,
});

const muestra = leccion({ uuid: '01a0fef2-0000-70bf-a4e4-000000000001', title: 'Muestra gratis', isPreview: true });
const segunda = leccion({ uuid: '01a0fef2-0000-70bf-a4e4-000000000002', title: 'Parte 2', position: 2 });

const crearDeps = (cambios: Partial<DependenciasLecciones> = {}): DependenciasLecciones => ({
  buscarCurso: vi.fn().mockResolvedValue({ courseId: 3, previewSeconds: 60 }),
  listar: vi.fn().mockResolvedValue([muestra, segunda]),
  comproElCurso: vi.fn().mockResolvedValue(false),
  crear: vi.fn(async (_courseId, datos) => leccion({ title: datos.title, position: datos.position })),
  actualizar: vi.fn(async (uuid, datos) => leccion({ uuid, title: datos.title })),
  eliminar: vi.fn().mockResolvedValue(true),
  quitarMuestras: vi.fn().mockResolvedValue(undefined),
  reordenar: vi.fn().mockResolvedValue(undefined),
  siguientePosicion: vi.fn().mockResolvedValue(3),
  ...cambios,
});

describe('temario para un visitante', () => {
  it('solo manda el video de la leccion de muestra', async () => {
    const servicio = crearServicioLecciones(crearDeps());

    const { lecciones, tieneAcceso } = await servicio.listarPublicas(CURSO);

    expect(tieneAcceso).toBe(false);
    expect(lecciones[0]).toMatchObject({
      titulo: 'Muestra gratis',
      esMuestra: true,
      bloqueada: false,
      youtubeId: 'dQw4w9WgXcQ',
    });
    // El resto del contenido no sale del servidor: ni la URL ni el id del video
    expect(lecciones[1]).toMatchObject({ bloqueada: true, videoUrl: null, youtubeId: null });
  });

  it('la muestra se corta en los segundos configurados del curso', async () => {
    const servicio = crearServicioLecciones(
      crearDeps({ buscarCurso: vi.fn().mockResolvedValue({ courseId: 3, previewSeconds: 10 }) })
    );

    const { lecciones, previewSegundos } = await servicio.listarPublicas(CURSO);

    expect(previewSegundos).toBe(10);
    expect(lecciones[0].limiteSegundos).toBe(10);
  });

  it('sin sesion ni siquiera se pregunta por la compra', async () => {
    const deps = crearDeps();

    await crearServicioLecciones(deps).listarPublicas(CURSO);

    expect(deps.comproElCurso).not.toHaveBeenCalled();
  });

  it('un curso que no existe responde 404', async () => {
    const servicio = crearServicioLecciones(crearDeps({ buscarCurso: vi.fn().mockResolvedValue(null) }));

    await expect(servicio.listarPublicas(CURSO)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('temario para quien ya compro', () => {
  const deps = () => crearDeps({ comproElCurso: vi.fn().mockResolvedValue(true) });

  it('manda el video de todas las lecciones y sin limite de tiempo', async () => {
    const servicio = crearServicioLecciones(deps());

    const { lecciones, tieneAcceso } = await servicio.listarPublicas(CURSO, 7);

    expect(tieneAcceso).toBe(true);
    expect(lecciones.every((l) => l.bloqueada === false)).toBe(true);
    expect(lecciones.every((l) => l.youtubeId === 'dQw4w9WgXcQ')).toBe(true);
    expect(lecciones.every((l) => l.limiteSegundos === null)).toBe(true);
  });

  it('comprueba la compra con el usuario de la sesion', async () => {
    const dependencias = deps();

    await crearServicioLecciones(dependencias).listarPublicas(CURSO, 7);

    expect(dependencias.comproElCurso).toHaveBeenCalledWith(7, 3);
  });
});

describe('temario desde el panel', () => {
  it('siempre llega completo, aunque el admin no haya comprado el curso', async () => {
    const servicio = crearServicioLecciones(crearDeps());

    const { lecciones } = await servicio.listarParaAdmin(CURSO);

    expect(lecciones.every((l) => l.bloqueada === false)).toBe(true);
    expect(lecciones[1].videoUrl).toBe(VIDEO);
  });
});

describe('administrar lecciones', () => {
  const datos = { title: 'Parte 3', esMuestra: false } as never;

  it('la leccion nueva se coloca al final', async () => {
    const deps = crearDeps();

    await crearServicioLecciones(deps).crear(CURSO, datos);

    expect(deps.crear).toHaveBeenCalledWith(3, expect.objectContaining({ position: 3 }));
  });

  it('marcar una muestra desmarca la anterior', async () => {
    const deps = crearDeps();

    await crearServicioLecciones(deps).crear(CURSO, { ...(datos as object), esMuestra: true } as never);

    expect(deps.quitarMuestras).toHaveBeenCalledWith(3, expect.any(String));
  });

  it('sin muestra no se toca el resto', async () => {
    const deps = crearDeps();

    await crearServicioLecciones(deps).crear(CURSO, datos);

    expect(deps.quitarMuestras).not.toHaveBeenCalled();
  });

  it('editar una leccion inexistente responde 404', async () => {
    const servicio = crearServicioLecciones(crearDeps({ actualizar: vi.fn().mockResolvedValue(null) }));

    await expect(servicio.actualizar(CURSO, 'otra', datos)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('eliminar algo que ya no esta responde 404', async () => {
    const servicio = crearServicioLecciones(crearDeps({ eliminar: vi.fn().mockResolvedValue(false) }));

    await expect(servicio.eliminar(CURSO, 'otra')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reordenar guarda el orden recibido y devuelve el temario', async () => {
    const deps = crearDeps();

    const temario = await crearServicioLecciones(deps).reordenar(CURSO, [segunda.uuid, muestra.uuid]);

    expect(deps.reordenar).toHaveBeenCalledWith(3, [segunda.uuid, muestra.uuid]);
    expect(temario.lecciones).toHaveLength(2);
  });
});
