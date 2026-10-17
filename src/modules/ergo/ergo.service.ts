import { prisma } from '../../core/database/prisma';

export const ergoService = {
  crearEmpresa: async (userId: number, nombre: string) => {
    return prisma.company.create({
      data: {
        userId,
        name: nombre,
      },
    });
  },
  
  
  
  crearFicha: async (companyId: number, userId: number, nombre: string, description: string | undefined, payload: any) => {
    const company = await prisma.company.findUnique({ where: { companyId } });
    if (company?.userId !== userId) throw new Error('No autorizado');

    return prisma.form.create({
      data: {
        companyId,
        name: nombre,
        description,
        payload,
      }
    });
  },

  obtenerFichas: async (companyId: number, userId: number) => {
    const company = await prisma.company.findUnique({ where: { companyId } });
    if (company?.userId !== userId) throw new Error('No autorizado');

    return prisma.form.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { formId: true, name: true, createdAt: true }
    });
  },

  obtenerEmpresas: async (userId: number) => {
    return prisma.company.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        companyId: true,
        name: true,
        createdAt: true,
      }
    });
  }
};
