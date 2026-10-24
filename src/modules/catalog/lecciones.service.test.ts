import { describe, expect, it, vi } from 'vitest';
import {
  crearServicioLecciones,
  type DependenciasLecciones,
  type LeccionBase,
  type VideosDeLecciones,
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
  actualizar: vi.fn(async (uuid, datos) => ({
    leccion: leccion({ uuid, title: datos.title }),
    videoAnterior: VIDEO,
  })),
  eliminar: vi.fn().mockResolvedValue({ videoAnterior: VIDEO }),
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
    const servicio = crearServicioLecciones(crearDeps({ eliminar: vi.fn().mockResolvedValue(null) }));

    await expect(servicio.eliminar(CURSO, 'otra')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reordenar guarda el orden recibido y devuelve el temario', async () => {
    const deps = crearDeps();

    const temario = await crearServicioLecciones(deps).reordenar(CURSO, [segunda.uuid, muestra.uuid]);

    expect(deps.reordenar).toHaveBeenCalledWith(3, [segunda.uuid, muestra.uuid]);
    expect(temario.lecciones).toHaveLength(2);
  });
});

// Doble del almacen: no firma nada de verdad, solo cuenta a quien se le pide
const crearVideosFalsos = (): VideosDeLecciones & {
  reproducir: ReturnType<typeof vi.fn>;
  eliminar: ReturnType<typeof vi.fn>;
} => ({
  reproducir: vi.fn(async (valor: string | null) =>
    valor === null ? null : { tipo: 'archivo' as const, url: `${valor}?firma=abc`, youtubeId: null }
  ),
  eliminar: vi.fn().mockResolvedValue(true),
});

describe('videos guardados en nuestro almacen', () => {
  const R2 = 'r2:cursos/b7b2/parte-1.mp4';

  it('la muestra llega con el enlace firmado y su tipo', async () => {
    const videos = crearVideosFalsos();
    const deps = crearDeps({ listar: vi.fn().mockResolvedValue([{ ...muestra, videoUrl: R2 }]) });

    const { lecciones } = await crearServicioLecciones(deps, videos).listarPublicas(CURSO);

    expect(lecciones[0]).toMatchObject({
      tipoVideo: 'archivo',
      videoUrl: `${R2}?firma=abc`,
      youtubeId: null,
      limiteSegundos: 60,
    });
  });

  it('de una leccion bloqueada no se firma nada', async () => {
    const videos = crearVideosFalsos();
    const deps = crearDeps({ listar: vi.fn().mockResolvedValue([{ ...segunda, videoUrl: R2 }]) });

    const { lecciones } = await crearServicioLecciones(deps, videos).listarPublicas(CURSO);

    expect(lecciones[0]).toMatchObject({ bloqueada: true, tipoVideo: null, videoUrl: null });
    expect(videos.reproducir).not.toHaveBeenCalled();
  });

  it('si el almacen falla la leccion sale sin video en vez de romper el temario', async () => {
    const videos = crearVideosFalsos();
    videos.reproducir.mockRejectedValue(new Error('almacen sin configurar'));
    const deps = crearDeps({ listar: vi.fn().mockResolvedValue([{ ...muestra, videoUrl: R2 }]) });

    const { lecciones } = await crearServicioLecciones(deps, videos).listarPublicas(CURSO);

    expect(lecciones[0]).toMatchObject({ bloqueada: false, tipoVideo: null, videoUrl: null });
  });

  it('el panel ve la referencia guardada, no el enlace firmado', async () => {
    const videos = crearVideosFalsos();
    const deps = crearDeps({ listar: vi.fn().mockResolvedValue([{ ...muestra, videoUrl: R2 }]) });

    const { lecciones } = await crearServicioLecciones(deps, videos).listarParaAdmin(CURSO);

    expect(lecciones[0].referencia).toBe(R2);
  });

  it('el temario publico no revela la referencia', async () => {
    const videos = crearVideosFalsos();
    const deps = crearDeps({ listar: vi.fn().mockResolvedValue([{ ...muestra, videoUrl: R2 }]) });

    const { lecciones } = await crearServicioLecciones(deps, videos).listarPublicas(CURSO);

    expect(lecciones[0].referencia).toBeUndefined();
  });

  it('al cambiar de video se borra el archivo que queda sin usar', async () => {
    const videos = crearVideosFalsos();
    const deps = crearDeps({
      actualizar: vi.fn().mockResolvedValue({
        leccion: { ...muestra, videoUrl: 'r2:cursos/b7b2/parte-1-nueva.mp4' },
        videoAnterior: R2,
      }),
    });

    await crearServicioLecciones(deps, videos).actualizar(CURSO, muestra.uuid, {
      title: 'Muestra gratis',
      esMuestra: false,
    } as never);

    expect(videos.eliminar).toHaveBeenCalledWith(R2);
  });

  it('guardar sin tocar el video no borra nada', async () => {
    const videos = crearVideosFalsos();
    const deps = crearDeps({
      actualizar: vi.fn().mockResolvedValue({
        leccion: { ...muestra, videoUrl: R2 },
        videoAnterior: R2,
      }),
    });

    await crearServicioLecciones(deps, videos).actualizar(CURSO, muestra.uuid, {
      title: 'Otro titulo',
      esMuestra: false,
    } as never);

    expect(videos.eliminar).not.toHaveBeenCalled();
  });

  it('al eliminar la leccion tambien se borra su archivo', async () => {
    const videos = crearVideosFalsos();
    const deps = crearDeps({ eliminar: vi.fn().mockResolvedValue({ videoAnterior: R2 }) });

    await crearServicioLecciones(deps, videos).eliminar(CURSO, muestra.uuid);

    expect(videos.eliminar).toHaveBeenCalledWith(R2);
  });
});
