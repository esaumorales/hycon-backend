import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../core/database/prisma', () => ({ prisma: {
  company: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  form: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  $transaction: vi.fn(),
} }));
import { prisma } from '../../core/database/prisma';
import { ergoService } from './ergo.service';
import type { FichaInput } from './ergo.schema';

const datos = { nombre: 'Ficha', payload: { extension: 'conservar' } } as unknown as FichaInput;
describe('aislamiento y persistencia de ergonomía', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async fn => (fn as (tx: unknown) => Promise<unknown>)(prisma) as never);
  });
  it('la lista de empresas pertenece exclusivamente al usuario', async () => {
    await ergoService.obtenerEmpresas(17);
    expect(prisma.company.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 17 } }));
  });
  it('no lista ni crea fichas de una empresa ajena o inexistente', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null);
    await expect(ergoService.obtenerFichas(4, 17)).rejects.toMatchObject({ statusCode: 404 });
    await expect(ergoService.crearFicha(4, 17, datos)).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.form.findMany).not.toHaveBeenCalled();
    expect(prisma.form.create).not.toHaveBeenCalled();
    expect(prisma.company.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 4, userId: 17 } }));
  });
  it('leer y editar una ficha comprueban empresa y propietario', async () => {
    vi.mocked(prisma.form.findFirst).mockResolvedValue(null);
    await expect(ergoService.obtenerFicha(4, 9, 17)).rejects.toMatchObject({ statusCode: 404 });
    await expect(ergoService.actualizarFicha(4, 9, 17, datos, '2026-10-17T00:00:00.000Z')).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.form.findFirst).toHaveBeenCalledWith({ where: { formId: 9, companyId: 4, company: { userId: 17 } } });
    expect(prisma.form.updateMany).not.toHaveBeenCalled();
  });
  it('guarda payload completo y actualiza únicamente la versión que se abrió', async () => {
    vi.mocked(prisma.form.findFirst).mockResolvedValue({ formId: 9 } as never);
    vi.mocked(prisma.form.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.form.findUniqueOrThrow).mockResolvedValue({ formId: 9, payload: datos.payload } as never);
    await ergoService.actualizarFicha(4, 9, 17, datos, '2026-10-17T00:00:00.000Z');
    expect(prisma.form.updateMany).toHaveBeenCalledWith({
      where: { formId: 9, companyId: 4, company: { userId: 17 }, updatedAt: new Date('2026-10-17T00:00:00.000Z') },
      data: { name: 'Ficha', description: undefined, payload: datos.payload },
    });
  });
  it('una versión antigua devuelve conflicto y no afirma que se guardó', async () => {
    vi.mocked(prisma.form.findFirst).mockResolvedValue({ formId: 9 } as never);
    vi.mocked(prisma.form.updateMany).mockResolvedValue({ count: 0 });
    await expect(ergoService.actualizarFicha(4, 9, 17, datos, '2026-10-17T00:00:00.000Z')).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.form.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
