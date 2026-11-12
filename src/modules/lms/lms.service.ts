import { prisma } from '../../core/database/prisma';
import { extraerIdYoutube } from '../../core/utils/youtube';
import { aPaginacion } from '../catalog/catalog.mapper';
import type { Listado } from '../catalog/catalog.service';
import type { MisCursosQuery } from './lms.schema';

// Un curso al que el usuario ya tiene acceso por haberlo comprado
export interface CursoCompradoBase {
  uuid: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  compradoEl: Date;
  // Avance del alumno en ese curso
  partes: number;
  vistas: number;
  // Codigo del certificado si ya lo emitio
  certificado: string | null;
}

export interface CursoComprado {
  uuid: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  youtubeId: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  compradoEl: string;
  partes: number;
  vistas: number;
  // true cuando vio todas las partes y ya puede pedir el certificado
  completado: boolean;
  certificado: string | null;
}

export interface DependenciasLms {
  cursosComprados(userId: number): Promise<CursoCompradoBase[]>;
}

export const dependenciasReales: DependenciasLms = {
  async cursosComprados(userId) {
    const lineas = await prisma.orderItem.findMany({
      where: { itemType: 'course', order: { userId }, course: { isNot: null } },
      select: {
        order: { select: { createdAt: true } },
        course: {
          select: {
            courseId: true,
            uuid: true,
            name: true,
            description: true,
            videoUrl: true,
            thumbnailUrl: true,
            durationMinutes: true,
            _count: { select: { lessons: true } },
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });

    // Un mismo curso puede aparecer en varios pedidos: se queda la compra mas reciente
    const vistos = new Map<number, { curso: (typeof lineas)[number]['course']; compradoEl: Date }>();
    for (const linea of lineas) {
      if (linea.course && !vistos.has(linea.course.courseId)) {
        vistos.set(linea.course.courseId, { curso: linea.course, compradoEl: linea.order.createdAt });
      }
    }

    const cursoIds = [...vistos.keys()];
    if (cursoIds.length === 0) return [];

    // Dos consultas mas, no una por curso: el avance y los certificados de toda la cuenta
    const [avance, certificados] = await Promise.all([
      prisma.lessonProgress.groupBy({
        by: ['lessonId'],
        where: { userId, lesson: { courseId: { in: cursoIds } } },
        _count: true,
      }),
      prisma.certificate.findMany({
        where: { userId, courseId: { in: cursoIds } },
        select: { courseId: true, certificateCode: true },
      }),
    ]);

    const leccionesVistas = await prisma.lesson.findMany({
      where: { lessonId: { in: avance.map((fila) => fila.lessonId) } },
      select: { lessonId: true, courseId: true },
    });

    const vistasPorCurso = new Map<number, number>();
    for (const leccion of leccionesVistas) {
      vistasPorCurso.set(leccion.courseId, (vistasPorCurso.get(leccion.courseId) ?? 0) + 1);
    }
    const certificadoPorCurso = new Map(
      certificados.map((fila) => [fila.courseId, fila.certificateCode])
    );

    return [...vistos.entries()].map(([courseId, { curso, compradoEl }]) => ({
      uuid: curso!.uuid,
      name: curso!.name,
      description: curso!.description,
      videoUrl: curso!.videoUrl,
      thumbnailUrl: curso!.thumbnailUrl,
      durationMinutes: curso!.durationMinutes,
      compradoEl,
      partes: curso!._count.lessons,
      vistas: vistasPorCurso.get(courseId) ?? 0,
      certificado: certificadoPorCurso.get(courseId) ?? null,
    }));
  },
};

export const aCursoComprado = (curso: CursoCompradoBase): CursoComprado => ({
  uuid: curso.uuid,
  name: curso.name,
  description: curso.description,
  videoUrl: curso.videoUrl,
  // Listo para incrustar, igual que en el catalogo
  youtubeId: extraerIdYoutube(curso.videoUrl),
  thumbnailUrl: curso.thumbnailUrl,
  durationMinutes: curso.durationMinutes,
  compradoEl: curso.compradoEl.toISOString(),
  partes: curso.partes,
  vistas: curso.vistas,
  // Un curso sin partes no se puede dar por terminado
  completado: curso.partes > 0 && curso.vistas >= curso.partes,
  certificado: curso.certificado,
});

// Busca en el nombre y en la descripcion, sin distinguir mayusculas ni acentos
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const coincide = (curso: CursoCompradoBase, buscar: string) => {
  const aguja = normalizar(buscar);
  return normalizar(`${curso.name} ${curso.description ?? ''}`).includes(aguja);
};

const ordenar = (cursos: CursoCompradoBase[], orden: MisCursosQuery['orden']) => {
  if (orden === 'nombre') return [...cursos].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const direccion = orden === 'antiguos' ? 1 : -1;
  return [...cursos].sort(
    (a, b) => direccion * (a.compradoEl.getTime() - b.compradoEl.getTime())
  );
};

export const crearServicioLms = (deps: DependenciasLms) => ({
  /**
   * Los cursos del usuario, filtrados y paginados. El corte se hace aqui y no en
   * la base porque un mismo curso puede venir de varios pedidos y hay que
   * quedarse con una sola fila por curso; son unas decenas por cuenta.
   */
  async misCursos(userId: number, consulta: MisCursosQuery): Promise<Listado<CursoComprado>> {
    const comprados = await deps.cursosComprados(userId);
    const filtrados = consulta.buscar
      ? comprados.filter((curso) => coincide(curso, consulta.buscar as string))
      : comprados;

    const ordenados = ordenar(filtrados, consulta.orden);
    const saltar = (consulta.pagina - 1) * consulta.porPagina;

    return {
      elementos: ordenados.slice(saltar, saltar + consulta.porPagina).map(aCursoComprado),
      paginacion: aPaginacion(consulta.pagina, consulta.porPagina, ordenados.length),
    };
  },
});

export const lmsService = crearServicioLms(dependenciasReales);
