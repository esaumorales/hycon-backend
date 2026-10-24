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
