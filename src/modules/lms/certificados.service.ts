import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/AppError';

// El nombre va impreso en el certificado: se acepta lo que es un nombre y nada mas
export const certificadoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'Escribe el nombre completo')
    .max(120, 'El nombre es demasiado largo')
    .regex(/^[\p{L}][\p{L}\s'.-]*$/u, 'El nombre solo admite letras, espacios y . - \''),
});

export type CertificadoInput = z.infer<typeof certificadoSchema>;

export interface ParteProgreso {
  uuid: string;
  titulo: string;
  posicion: number;
  vista: boolean;
}

export interface CertificadoPublico {
  codigo: string;
  // Nombre confirmado al emitirlo; ya no cambia
  nombre: string;
  curso: string;
  duracionMinutos: number | null;
  emitidoEl: string;
}

export interface ProgresoCurso {
  cursoUuid: string;
  curso: string;
  partes: ParteProgreso[];
  vistas: number;
  total: number;
  // true cuando no queda ninguna parte por ver
  completado: boolean;
  certificado: CertificadoPublico | null;
}

export interface CursoBase {
  courseId: number;
  name: string;
  durationMinutes: number | null;
}

export interface LeccionBase {
  lessonId: number;
  uuid: string;
  title: string;
  position: number;
}

export interface CertificadoBase {
  certificateCode: string;
  holderName: string;
  issuedAt: Date;
}

export interface DependenciasCertificados {
  buscarCurso(uuid: string): Promise<CursoBase | null>;
  comproElCurso(userId: number, courseId: number): Promise<boolean>;
  listarPartes(courseId: number): Promise<LeccionBase[]>;
  // Identificadores de las partes que ese usuario ya vio
  partesVistas(userId: number, courseId: number): Promise<number[]>;
  marcarVista(userId: number, lessonId: number): Promise<void>;
  certificadoDe(userId: number, courseId: number): Promise<CertificadoBase | null>;
  emitir(datos: {
    userId: number;
    courseId: number;
    certificateCode: string;
    holderName: string;
  }): Promise<CertificadoBase>;
}

const seleccionParte = { lessonId: true, uuid: true, title: true, position: true } as const;
const seleccionCertificado = { certificateCode: true, holderName: true, issuedAt: true } as const;

export const dependenciasReales: DependenciasCertificados = {
  buscarCurso: (uuid) =>
    prisma.course.findUnique({
      where: { uuid },
      select: { courseId: true, name: true, durationMinutes: true },
    }),

  async comproElCurso(userId, courseId) {
    const compra = await prisma.orderItem.findFirst({
      where: { courseId, order: { userId } },
      select: { orderItemId: true },
    });
    return compra !== null;
  },

  listarPartes: (courseId) =>
    prisma.lesson.findMany({
      where: { courseId },
      select: seleccionParte,
      orderBy: { position: 'asc' },
    }),

  async partesVistas(userId, courseId) {
    const filas = await prisma.lessonProgress.findMany({
      where: { userId, lesson: { courseId } },
      select: { lessonId: true },
    });
    return filas.map((fila) => fila.lessonId);
  },

  async marcarVista(userId, lessonId) {
    // Volver a ver una parte no cambia nada: la marca es una sola
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {},
      create: { userId, lessonId },
    });
  },

  certificadoDe: (userId, courseId) =>
    prisma.certificate.findFirst({
      where: { userId, courseId },
      select: seleccionCertificado,
    }),

  emitir: (datos) => prisma.certificate.create({ data: datos, select: seleccionCertificado }),
};

/** Codigo corto que se imprime en el certificado y sirve para ubicarlo. */
export const codigoDeCertificado = () => `HY-${randomUUID().slice(-8).toUpperCase()}`;

export const aCertificadoPublico = (
  certificado: CertificadoBase,
  curso: CursoBase
): CertificadoPublico => ({
  codigo: certificado.certificateCode,
  nombre: certificado.holderName,
  curso: curso.name,
  duracionMinutos: curso.durationMinutes,
  emitidoEl: certificado.issuedAt.toISOString(),
});

export const crearServicioCertificados = (deps: DependenciasCertificados) => {
  // Entrar aqui exige haber comprado el curso: lo demas cuelga de eso
  const exigirAcceso = async (cursoUuid: string, userId: number) => {
    const curso = await deps.buscarCurso(cursoUuid);
    if (!curso) throw new AppError('Curso no encontrado', 404);

    const compro = await deps.comproElCurso(userId, curso.courseId);
    if (!compro) throw new AppError('Este curso no esta en tu cuenta', 403);

    return curso;
  };

  const armarProgreso = async (curso: CursoBase, cursoUuid: string, userId: number) => {
    const [partes, vistas, certificado] = await Promise.all([
      deps.listarPartes(curso.courseId),
      deps.partesVistas(userId, curso.courseId),
      deps.certificadoDe(userId, curso.courseId),
    ]);

    const marcadas = new Set(vistas);
    const detalle: ParteProgreso[] = partes.map((parte) => ({
      uuid: parte.uuid,
      titulo: parte.title,
      posicion: parte.position,
      vista: marcadas.has(parte.lessonId),
    }));

    const porVer = detalle.filter((parte) => parte.vista).length;

    return {
      cursoUuid,
      curso: curso.name,
      partes: detalle,
      vistas: porVer,
      total: detalle.length,
      // Un curso sin partes no se puede dar por terminado
      completado: detalle.length > 0 && porVer === detalle.length,
      certificado: certificado ? aCertificadoPublico(certificado, curso) : null,
    };
  };

  return {
    async progreso(cursoUuid: string, userId: number): Promise<ProgresoCurso> {
      const curso = await exigirAcceso(cursoUuid, userId);
      return armarProgreso(curso, cursoUuid, userId);
    },

    /** Marca una parte como vista. Repetirlo no cambia nada. */
    async marcarVista(
      cursoUuid: string,
      leccionUuid: string,
      userId: number
    ): Promise<ProgresoCurso> {
      const curso = await exigirAcceso(cursoUuid, userId);
      const partes = await deps.listarPartes(curso.courseId);
      const parte = partes.find((fila) => fila.uuid === leccionUuid);
      if (!parte) throw new AppError('Esa parte no es de este curso', 404);

      await deps.marcarVista(userId, parte.lessonId);
      return armarProgreso(curso, cursoUuid, userId);
    },

    /**
     * Emite el certificado con el nombre que confirma el alumno. Se emite una
     * sola vez: el nombre queda fijo y no se puede volver a pedir.
     */
    async emitir(
      cursoUuid: string,
      userId: number,
      datos: CertificadoInput
    ): Promise<CertificadoPublico> {
      const curso = await exigirAcceso(cursoUuid, userId);

      const yaEmitido = await deps.certificadoDe(userId, curso.courseId);
      if (yaEmitido) {
        throw new AppError('Ya tienes el certificado de este curso', 409);
      }

      const progreso = await armarProgreso(curso, cursoUuid, userId);
      if (!progreso.completado) {
        throw new AppError('Termina todas las partes del curso para pedir el certificado', 409);
      }

      const certificado = await deps.emitir({
        userId,
        courseId: curso.courseId,
        certificateCode: codigoDeCertificado(),
        holderName: datos.nombre,
      });

      return aCertificadoPublico(certificado, curso);
    },
  };
};

export const certificadosService = crearServicioCertificados(dependenciasReales);
