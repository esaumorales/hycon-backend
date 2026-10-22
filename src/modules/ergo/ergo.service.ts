import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/AppError';
import type { Prisma } from '../../generated/prisma/client';
import type { FichaInput } from './ergo.schema';

const seleccionEmpresa = { companyId: true, name: true, createdAt: true, _count: { select: { forms: true } } } as const;
async function empresaPropia(companyId: number, userId: number) {
  const empresa = await prisma.company.findFirst({ where: { companyId, userId }, select: seleccionEmpresa });
  if (!empresa) throw new AppError('No se encontró esta empresa.', 404);
  return empresa;
}
export const ergoService = {
  crearEmpresa: (userId: number, nombre: string) => prisma.company.create({ data: { userId, name: nombre }, select: seleccionEmpresa }),
  obtenerEmpresas: (userId: number) => prisma.company.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: seleccionEmpresa }),
  obtenerEmpresa: empresaPropia,
  obtenerFichas: async (companyId: number, userId: number) => {
    await empresaPropia(companyId, userId);
    return prisma.form.findMany({ where: { companyId }, orderBy: { updatedAt: 'desc' } });
  },
  obtenerFicha: async (companyId: number, formId: number, userId: number) => {
    const ficha = await prisma.form.findFirst({ where: { formId, companyId, company: { userId } } });
    if (!ficha) throw new AppError('No se encontró esta ficha en la empresa.', 404);
    return ficha;
  },
  crearFicha: async (companyId: number, userId: number, datos: FichaInput) => {
    await empresaPropia(companyId, userId);
    return prisma.form.create({ data: { companyId, name: datos.nombre, description: datos.description, payload: datos.payload as Prisma.InputJsonObject } });
  },
  actualizarFicha: async (companyId: number, formId: number, userId: number, datos: FichaInput, version: string) => {
    // La versión en el UPDATE impide sobrescribir cambios de otra sesión.
    return prisma.$transaction(async tx => {
      const ficha = await tx.form.findFirst({ where: { formId, companyId, company: { userId } } });
      if (!ficha) throw new AppError('No se encontró esta ficha en la empresa.', 404);
      const resultado = await tx.form.updateMany({
        where: { formId, companyId, company: { userId }, updatedAt: new Date(version) },
        data: { name: datos.nombre, description: datos.description, payload: datos.payload as Prisma.InputJsonObject },
      });
      if (resultado.count !== 1) throw new AppError('Otra sesión actualizó esta ficha. Conserva tus cambios y vuelve a abrirla para revisar la versión más reciente.', 409);
      return tx.form.findUniqueOrThrow({ where: { formId } });
    });
  },
};
