import { z } from 'zod';
import { prisma } from '../../core/database/prisma';
import { listarConTotal } from '../../core/database/consultas';
import { AppError } from '../../core/errors/AppError';
import { aPaginacion } from '../catalog/catalog.mapper';
import type { Listado, ConsultaListado } from '../catalog/catalog.service';
import type { PaginaDe } from '../catalog/catalog.types';
import {
  buscarEvaluacion,
  CODIGOS_EVALUACION,
  EVALUACIONES,
  type EvaluacionErgonomica,
} from './cotizaciones.constants';

export const cotizacionSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  company: z.string().trim().max(150).optional(),
  phone: z
    .string()
    .trim()
    .min(6, 'El telefono es demasiado corto')
    .max(30)
    .regex(/^[\d+()\s-]+$/, 'El telefono solo admite numeros y los signos + ( ) -'),
  email: z.string().trim().toLowerCase().email('El correo no tiene un formato valido').max(150),
  message: z.string().trim().max(1000).optional(),
  evaluaciones: z
    .array(z.enum(CODIGOS_EVALUACION as [string, ...string[]]))
    .min(1, 'Elige al menos una evaluacion'),
});

export type CotizacionInput = z.infer<typeof cotizacionSchema>;

export interface CotizacionBase {
  uuid: string;
  name: string;
  company: string | null;
  phone: string;
  email: string;
  message: string | null;
  evaluations: string[];
  total: { toString(): string };
  status: string;
  createdAt: Date;
}

export interface CotizacionPublica {
  uuid: string;
  // Codigo corto para que el cliente lo mencione al escribirnos
  codigo: string;
  nombre: string;
  empresa: string | null;
  telefono: string;
  correo: string;
  mensaje: string | null;
  evaluaciones: EvaluacionErgonomica[];
  total: number;
  estado: string;
  createdAt: string;
}

export interface DependenciasCotizaciones {
  crear(datos: {
    name: string;
    company?: string;
    phone: string;
    email: string;
    message?: string;
    evaluations: string[];
    total: number;
  }): Promise<CotizacionBase>;
  listar(consulta: ConsultaListado): Promise<PaginaDe<CotizacionBase>>;
}

const seleccion = {
  uuid: true,
  name: true,
  company: true,
  phone: true,
  email: true,
  message: true,
  evaluations: true,
  total: true,
  status: true,
  createdAt: true,
} as const;

export const dependenciasReales: DependenciasCotizaciones = {
  crear: ({ company, message, ...datos }) =>
    prisma.quoteRequest.create({
      data: { ...datos, company: company ?? null, message: message ?? null },
      select: seleccion,
    }),

  listar: ({ saltar, tomar }) =>
    listarConTotal(
      () =>
        prisma.quoteRequest.findMany({
          select: seleccion,
          orderBy: { createdAt: 'desc' },
          skip: saltar,
          take: tomar,
        }),
      () => prisma.quoteRequest.count()
    ),
};

export const aCotizacionPublica = (cotizacion: CotizacionBase): CotizacionPublica => ({
  uuid: cotizacion.uuid,
  codigo: `COT-${cotizacion.uuid.slice(-6).toUpperCase()}`,
  nombre: cotizacion.name,
  empresa: cotizacion.company,
  telefono: cotizacion.phone,
  correo: cotizacion.email,
  mensaje: cotizacion.message,
  // Se devuelven con su nombre y precio, no solo el codigo
  evaluaciones: cotizacion.evaluations
    .map(buscarEvaluacion)
    .filter((evaluacion): evaluacion is EvaluacionErgonomica => evaluacion !== undefined),
  total: Number(cotizacion.total.toString()),
  estado: cotizacion.status,
  createdAt: cotizacion.createdAt.toISOString(),
});

export const crearServicioCotizaciones = (deps: DependenciasCotizaciones) => ({
  /** Las evaluaciones que se ofrecen, con sus normas y precios. */
  evaluaciones: (): EvaluacionErgonomica[] => EVALUACIONES,

  async crear(datos: CotizacionInput): Promise<CotizacionPublica> {
    // Sin repetidos: pedir dos veces la misma evaluacion no duplica el precio
    const codigos = [...new Set(datos.evaluaciones)];
    const elegidas = codigos.map(buscarEvaluacion);

    if (elegidas.some((evaluacion) => evaluacion === undefined)) {
      throw new AppError('Una de las evaluaciones pedidas no existe', 422);
    }

    // El total lo calcula el servidor con sus propios precios
    const total = elegidas.reduce((suma, evaluacion) => suma + (evaluacion?.precio ?? 0), 0);

    const guardada = await deps.crear({
      name: datos.name,
      company: datos.company,
      phone: datos.phone,
      email: datos.email,
      message: datos.message,
      evaluations: codigos,
      total,
    });
    return aCotizacionPublica(guardada);
  },

  async listar({
    pagina,
    porPagina,
  }: {
    pagina: number;
    porPagina: number;
  }): Promise<Listado<CotizacionPublica>> {
    const { filas, total } = await deps.listar({
      estado: 'todos',
      saltar: (pagina - 1) * porPagina,
      tomar: porPagina,
    });
    return {
      elementos: filas.map(aCotizacionPublica),
      paginacion: aPaginacion(pagina, porPagina, total),
    };
  },
});

export const cotizacionesService = crearServicioCotizaciones(dependenciasReales);
