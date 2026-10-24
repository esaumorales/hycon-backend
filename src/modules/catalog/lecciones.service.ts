import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/AppError';
import { almacenVideos, type AlmacenVideos, type TipoReproduccion } from '../media/videos.service';
import type { LeccionInput } from './lecciones.schema';

export interface LeccionBase {
  uuid: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  durationMinutes: number | null;
  position: number;
  isPreview: boolean;
}

/**
 * Lo que se expone por la API. El video solo viaja si quien pregunta puede verlo:
 * asi el contenido no se filtra ni mirando la respuesta en el navegador.
 */
export interface LeccionPublica {
  uuid: string;
  titulo: string;
  descripcion: string | null;
  duracionMinutos: number | null;
  posicion: number;
  esMuestra: boolean;
  // true cuando hay que comprar el curso para verla
  bloqueada: boolean;
  // Con que reproductor se ve: youtube, archivo propio o reproductor incrustado
  tipoVideo: TipoReproduccion | null;
  // Enlace listo para reproducir; firmado y temporal cuando el video es nuestro
  videoUrl: string | null;
  youtubeId: string | null;
  // Lo que esta guardado en la base, solo para el panel que lo edita
  referencia?: string | null;
  // Segundos que se dejan ver de la muestra; null cuando se puede ver entera
  limiteSegundos: number | null;
}

export interface CursoConLecciones {
  cursoUuid: string;
  tieneAcceso: boolean;
  previewSegundos: number;
  lecciones: LeccionPublica[];
}

export interface DependenciasLecciones {
  buscarCurso(uuid: string): Promise<{ courseId: number; previewSeconds: number } | null>;
  listar(courseId: number): Promise<LeccionBase[]>;
  comproElCurso(userId: number, courseId: number): Promise<boolean>;
  crear(courseId: number, datos: LeccionInput & { position: number }): Promise<LeccionBase>;
  // Devuelve tambien el video que tenia, para borrar el archivo que se reemplaza
  actualizar(
    uuid: string,
    datos: LeccionInput
  ): Promise<{ leccion: LeccionBase; videoAnterior: string | null } | null>;
  eliminar(uuid: string): Promise<{ videoAnterior: string | null } | null>;
  // Deja una sola leccion marcada como muestra dentro del curso
  quitarMuestras(courseId: number, salvoUuid?: string): Promise<void>;
  reordenar(courseId: number, uuids: string[]): Promise<void>;
  siguientePosicion(courseId: number): Promise<number>;
}

const seleccion = {
  uuid: true,
  title: true,
  description: true,
  videoUrl: true,
  durationMinutes: true,
  position: true,
  isPreview: true,
} as const;

export const dependenciasReales: DependenciasLecciones = {
  buscarCurso: (uuid) =>
    prisma.course.findUnique({ where: { uuid }, select: { courseId: true, previewSeconds: true } }),

  listar: (courseId) =>
    prisma.lesson.findMany({ where: { courseId }, select: seleccion, orderBy: { position: 'asc' } }),

  async comproElCurso(userId, courseId) {
    const compra = await prisma.orderItem.findFirst({
      where: { courseId, order: { userId } },
      select: { orderItemId: true },
    });
    return compra !== null;
  },

  crear: (courseId, { title, description, videoUrl, durationMinutes, esMuestra, position }) =>
    prisma.lesson.create({
      data: {
        courseId,
        title,
        description: description ?? null,
        videoUrl: videoUrl ?? null,
        durationMinutes: durationMinutes ?? null,
        position,
        isPreview: esMuestra,
      },
      select: seleccion,
    }),

  async actualizar(uuid, { title, description, videoUrl, durationMinutes, esMuestra }) {
    const existe = await prisma.lesson.findUnique({
      where: { uuid },
      select: { lessonId: true, videoUrl: true },
    });
    if (!existe) return null;

    const leccion = await prisma.lesson.update({
      where: { uuid },
      data: {
        title,
        description: description ?? null,
        videoUrl: videoUrl ?? null,
        durationMinutes: durationMinutes ?? null,
        isPreview: esMuestra,
      },
      select: seleccion,
    });

    return { leccion, videoAnterior: existe.videoUrl };
  },

  async eliminar(uuid) {
    const existe = await prisma.lesson.findUnique({ where: { uuid }, select: { videoUrl: true } });
    if (!existe) return null;

    const borradas = await prisma.lesson.deleteMany({ where: { uuid } });
    return borradas.count > 0 ? { videoAnterior: existe.videoUrl } : null;
  },

  async quitarMuestras(courseId, salvoUuid) {
    await prisma.lesson.updateMany({
      where: { courseId, isPreview: true, ...(salvoUuid ? { NOT: { uuid: salvoUuid } } : {}) },
      data: { isPreview: false },
    });
  },

  async reordenar(courseId, uuids) {
    await prisma.$transaction(
      uuids.map((uuid, indice) =>
        prisma.lesson.updateMany({ where: { uuid, courseId }, data: { position: indice + 1 } })
      )
    );
  },

  async siguientePosicion(courseId) {
    const ultima = await prisma.lesson.findFirst({
      where: { courseId },
      select: { position: true },
      orderBy: { position: 'desc' },
    });
    return (ultima?.position ?? 0) + 1;
  },
};

export type VideosDeLecciones = Pick<AlmacenVideos, 'reproducir' | 'eliminar'>;

interface Contexto {
  tieneAcceso: boolean;
  previewSegundos: number;
  // El panel necesita ver la referencia guardada para poder editarla
  paraAdmin?: boolean;
}

export const crearServicioLecciones = (
  deps: DependenciasLecciones,
  videos: VideosDeLecciones = almacenVideos
) => {
  const exigirCurso = async (cursoUuid: string) => {
    const curso = await deps.buscarCurso(cursoUuid);
    if (!curso) throw new AppError('Curso no encontrado', 404);
    return curso;
  };

  // Un video que ya no se puede firmar no debe tumbar el temario entero
  const resolver = async (valor: string | null) => {
    try {
      return await videos.reproducir(valor);
    } catch {
      return null;
    }
  };

  const aPublica = async (
    leccion: LeccionBase,
    { tieneAcceso, previewSegundos, paraAdmin = false }: Contexto
  ): Promise<LeccionPublica> => {
    // Quien compro ve todo; el resto solo la leccion marcada como muestra
    const puedeVer = tieneAcceso || leccion.isPreview;
    const reproduccion = puedeVer ? await resolver(leccion.videoUrl) : null;

    return {
      uuid: leccion.uuid,
      titulo: leccion.title,
      descripcion: leccion.description,
      duracionMinutos: leccion.durationMinutes,
      posicion: leccion.position,
      esMuestra: leccion.isPreview,
      bloqueada: !puedeVer,
      tipoVideo: reproduccion?.tipo ?? null,
      videoUrl: reproduccion?.url ?? null,
      youtubeId: reproduccion?.youtubeId ?? null,
      ...(paraAdmin ? { referencia: leccion.videoUrl } : {}),
      limiteSegundos: puedeVer && !tieneAcceso ? previewSegundos : null,
    };
  };

  const aPublicas = (lecciones: LeccionBase[], contexto: Contexto) =>
    Promise.all(lecciones.map((leccion) => aPublica(leccion, contexto)));

  return {
    /** Temario del curso con el video solo de lo que ese usuario puede ver. */
    async listarPublicas(cursoUuid: string, userId?: number): Promise<CursoConLecciones> {
      const curso = await exigirCurso(cursoUuid);
      const [lecciones, compro] = await Promise.all([
        deps.listar(curso.courseId),
        userId ? deps.comproElCurso(userId, curso.courseId) : Promise.resolve(false),
      ]);

      return {
        cursoUuid,
        tieneAcceso: compro,
        previewSegundos: curso.previewSeconds,
        lecciones: await aPublicas(lecciones, {
          tieneAcceso: compro,
          previewSegundos: curso.previewSeconds,
        }),
      };
    },

    /** Para el panel: siempre con el video, porque es quien lo administra. */
    async listarParaAdmin(cursoUuid: string): Promise<CursoConLecciones> {
      const curso = await exigirCurso(cursoUuid);
      const lecciones = await deps.listar(curso.courseId);
      return {
        cursoUuid,
        tieneAcceso: true,
        previewSegundos: curso.previewSeconds,
        lecciones: await aPublicas(lecciones, {
          tieneAcceso: true,
          previewSegundos: curso.previewSeconds,
          paraAdmin: true,
        }),
      };
    },

    async crear(cursoUuid: string, datos: LeccionInput): Promise<LeccionPublica> {
      const curso = await exigirCurso(cursoUuid);
      const posicion = await deps.siguientePosicion(curso.courseId);
      const creada = await deps.crear(curso.courseId, { ...datos, position: posicion });
      // Solo puede haber una muestra por curso
      if (datos.esMuestra) await deps.quitarMuestras(curso.courseId, creada.uuid);
      return aPublica(creada, {
        tieneAcceso: true,
        previewSegundos: curso.previewSeconds,
        paraAdmin: true,
      });
    },

    async actualizar(
      cursoUuid: string,
      leccionUuid: string,
      datos: LeccionInput
    ): Promise<LeccionPublica> {
      const curso = await exigirCurso(cursoUuid);
      const resultado = await deps.actualizar(leccionUuid, datos);
      if (!resultado) throw new AppError('Leccion no encontrada', 404);
      if (datos.esMuestra) await deps.quitarMuestras(curso.courseId, leccionUuid);

      // El archivo que se queda sin usar se borra para no seguir pagandolo
      if (resultado.videoAnterior && resultado.videoAnterior !== resultado.leccion.videoUrl) {
        await videos.eliminar(resultado.videoAnterior);
      }

      return aPublica(resultado.leccion, {
        tieneAcceso: true,
        previewSegundos: curso.previewSeconds,
        paraAdmin: true,
      });
    },

    async eliminar(cursoUuid: string, leccionUuid: string): Promise<void> {
      await exigirCurso(cursoUuid);
      const borrada = await deps.eliminar(leccionUuid);
      if (!borrada) throw new AppError('Leccion no encontrada', 404);
      await videos.eliminar(borrada.videoAnterior);
    },

    async reordenar(cursoUuid: string, uuids: string[]): Promise<CursoConLecciones> {
      const curso = await exigirCurso(cursoUuid);
      await deps.reordenar(curso.courseId, uuids);
      return this.listarParaAdmin(cursoUuid);
    },
  };
};

export const leccionesService = crearServicioLecciones(dependenciasReales);
