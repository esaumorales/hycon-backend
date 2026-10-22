import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
vi.mock('./ergo.service', () => ({ ergoService: {
  crearEmpresa: vi.fn(), obtenerEmpresas: vi.fn(), obtenerEmpresa: vi.fn(),
  obtenerFichas: vi.fn(), obtenerFicha: vi.fn(), crearFicha: vi.fn(), actualizarFicha: vi.fn(),
} }));
import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';
import { ergoService } from './ergo.service';
import { AppError } from '../../core/errors/AppError';

const auth = 'Bearer ' + firmarToken({ userId: 17, email: 'prueba@example.com', rol: 'CLIENTE' });
const BASE = '/api/v1/ergo/empresas';
const payload = {
  paso1: { area: '', puesto: '', resumenPuesto: '', actividad: '', superintendencia: '', gerencia: '' },
  paso2: { duracionMinutos: '', cotidiana: null, duracionMayor120: false, requiereIdentificacion: false },
  paso3: {}, paso4: {}, paso5: { esfuerzoManos: { impactoRepetido: { aplica: true, duracionDiaria: '121' }, vibracionBrazoMano: { aplica: true, duracionDiaria: '31' } }, movimientosAltaFrecuencia: {} },
  evaluacion: { movimientosRepetitivos: { dx: '', ix: '' }, posturaForzada: { d: '', i: '' }, levantamientoCargas: { niosh: '' } },
};
const fecha = new Date('2026-10-17T10:00:00.000Z');
const ficha = { formId: 9, companyId: 4, name: 'Ficha', createdAt: fecha, updatedAt: fecha, payload };
describe('API ergonómica', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(ergoService.crearEmpresa).mockResolvedValue({ companyId: 4, name: 'Empresa', createdAt: fecha, _count: { forms: 0 } });
    vi.mocked(ergoService.crearFicha).mockResolvedValue(ficha as never);
    vi.mocked(ergoService.actualizarFicha).mockResolvedValue(ficha as never);
    vi.mocked(ergoService.obtenerFicha).mockResolvedValue(ficha as never);
  });
  it('todas las operaciones requieren sesión', async () => {
    const respuestas = await Promise.all([request(app).get(BASE), request(app).post(BASE).send({ nombre: 'Empresa' }), request(app).get(BASE + '/4'), request(app).get(BASE + '/4/fichas'), request(app).post(BASE + '/4/fichas').send({ nombre: 'Ficha', payload }), request(app).get(BASE + '/4/fichas/9'), request(app).put(BASE + '/4/fichas/9').send({ nombre: 'Ficha', payload, version: fecha.toISOString() })]);
    expect(respuestas.map(r => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
    expect(ergoService.crearFicha).not.toHaveBeenCalled();
  });
  it('registra una empresa solo con nombre y rechaza nombres vacíos', async () => {
    const r = await request(app).post(BASE).set('Authorization', auth).send({ nombre: ' Empresa ' });
    expect(r.status).toBe(201); expect(r.body.data.totalFichas).toBe(0);
    expect(ergoService.crearEmpresa).toHaveBeenCalledWith(17, 'Empresa');
    expect((await request(app).post(BASE).set('Authorization', auth).send({ nombre: '  ' })).status).toBe(400);
  });
  it.each(['0', '-1', '4x', '1.2', '9007199254740992'])('rechaza id inválido %s', async id => {
    expect((await request(app).get(BASE + '/' + id + '/fichas').set('Authorization', auth)).status).toBe(400);
    expect(ergoService.obtenerFichas).not.toHaveBeenCalled();
  });
  it('acepta nuevos factores con resultados opcionales vacíos y devuelve el documento', async () => {
    const r = await request(app).post(BASE + '/4/fichas').set('Authorization', auth).send({ nombre: 'Ficha', payload });
    expect(r.status).toBe(201); expect(r.body.data.payload).toEqual(payload);
    expect(ergoService.crearFicha).toHaveBeenCalledWith(4, 17, { nombre: 'Ficha', payload });
  });
  it('edita con id de empresa, ficha y versión; la lectura recupera el mismo documento', async () => {
    const r = await request(app).put(BASE + '/4/fichas/9').set('Authorization', auth).send({ nombre: 'Ficha', payload, version: fecha.toISOString() });
    expect(r.status).toBe(200);
    expect(ergoService.actualizarFicha).toHaveBeenCalledWith(4, 9, 17, expect.objectContaining({ nombre: 'Ficha', payload }), fecha.toISOString());
    const lectura = await request(app).get(BASE + '/4/fichas/9').set('Authorization', auth);
    expect(lectura.body.data.payload.paso5.esfuerzoManos).toEqual(payload.paso5.esfuerzoManos);
  });
  it('rechaza duraciones y resultados inválidos sin llamar al guardado', async () => {
    const invalido = structuredClone(payload); invalido.paso5.esfuerzoManos.vibracionBrazoMano.duracionDiaria = '-1';
    expect((await request(app).post(BASE + '/4/fichas').set('Authorization', auth).send({ nombre: 'Ficha', payload: invalido })).status).toBe(400);
    const resultado = structuredClone(payload); resultado.evaluacion.movimientosRepetitivos.dx = 'NaN';
    expect((await request(app).post(BASE + '/4/fichas').set('Authorization', auth).send({ nombre: 'Ficha', payload: resultado })).status).toBe(400);
    expect(ergoService.crearFicha).not.toHaveBeenCalled();
  });
  it('comunica 404 para una ficha fuera de alcance y 409 para una edición antigua', async () => {
    vi.mocked(ergoService.obtenerFicha).mockRejectedValue(new AppError('No se encontró esta ficha en la empresa.', 404));
    expect((await request(app).get(BASE + '/5/fichas/9').set('Authorization', auth)).status).toBe(404);
    vi.mocked(ergoService.actualizarFicha).mockRejectedValue(new AppError('Otra sesión actualizó esta ficha.', 409));
    expect((await request(app).put(BASE + '/4/fichas/9').set('Authorization', auth).send({ nombre: 'Ficha', payload, version: fecha.toISOString() })).status).toBe(409);
  });
});
