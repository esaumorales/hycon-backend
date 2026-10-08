import { prisma } from '../../core/database/prisma';
import { extraerIdYoutube } from '../../core/utils/youtube';

// Un curso al que el usuario ya tiene acceso por haberlo comprado
export interface CursoCompradoBase {
  uuid: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  compradoEl: Date;
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
            uuid: true,
            name: true,
            description: true,
            videoUrl: true,
            thumbnailUrl: true,
            durationMinutes: true,
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });

    // Un mismo curso puede aparecer en varios pedidos: se queda la compra mas reciente
    const vistos = new Map<string, CursoCompradoBase>();
    for (const linea of lineas) {
      if (linea.course && !vistos.has(linea.course.uuid)) {
        vistos.set(linea.course.uuid, { ...linea.course, compradoEl: linea.order.createdAt });
      }
    }
    return [...vistos.values()];
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
});

export const crearServicioLms = (deps: DependenciasLms) => ({
  async misCursos(userId: number): Promise<CursoComprado[]> {
    const cursos = await deps.cursosComprados(userId);
    return cursos.map(aCursoComprado);
  },
});

export const lmsService = crearServicioLms(dependenciasReales);
