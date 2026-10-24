import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Las rutas se prueban sin base de datos: el servicio se sustituye
vi.mock('./orders.service', () => ({
  ordersService: {
    crear: vi.fn(),
    listarMios: vi.fn(),
  },
}));

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';
import { AppError } from '../../core/errors/AppError';
import { ordersService } from './orders.service';

const cliente = `Bearer ${firmarToken({ userId: 7, email: 'ana@hycon.com', rol: 'CLIENTE' })}`;
const UUID = '7b73989c-0719-4c06-bd1e-8c7ae193a432';
const cuerpo = {
  metodoPago: 'tarjeta',
  items: [{ tipo: 'producto', uuid: UUID, cantidad: 2 }],
};

describe('/api/v1/orders', () => {
  beforeEach(() => {
    vi.mocked(ordersService.crear).mockResolvedValue({ uuid: UUID, codigo: 'PED-7B7398' } as never);
    vi.mocked(ordersService.listarMios).mockResolvedValue({
      elementos: [],
      paginacion: { pagina: 1, porPagina: 6, total: 0, totalPaginas: 1 },
    } as never);
  });

  it('comprar exige sesion', async () => {
    const respuesta = await request(app).post('/api/v1/orders').send(cuerpo);

    expect(respuesta.status).toBe(401);
    expect(ordersService.crear).not.toHaveBeenCalled();
  });

  it('ver mis compras exige sesion', async () => {
    const respuesta = await request(app).get('/api/v1/orders/mios');

    expect(respuesta.status).toBe(401);
    expect(ordersService.listarMios).not.toHaveBeenCalled();
  });

  it('guarda el pedido del usuario de la sesion y responde 201', async () => {
    const respuesta = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', cliente)
      .send(cuerpo);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.pedido.codigo).toBe('PED-7B7398');
    expect(ordersService.crear).toHaveBeenCalledWith(
      expect.objectContaining({ metodoPago: 'tarjeta' }),
      7
    );
  });

  it('un cuerpo invalido no llega al servicio', async () => {
    const sinItems = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', cliente)
      .send({ metodoPago: 'tarjeta', items: [] });
    const metodoInventado = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', cliente)
      .send({ ...cuerpo, metodoPago: 'efectivo' });
    const idQueNoEsUuid = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', cliente)
      .send({ metodoPago: 'yape', items: [{ tipo: 'producto', uuid: '3', cantidad: 1 }] });

    expect(sinItems.status).toBe(422);
    expect(metodoInventado.status).toBe(422);
    expect(idQueNoEsUuid.status).toBe(422);
    expect(ordersService.crear).not.toHaveBeenCalled();
  });

  it('cada quien ve solo sus compras, paginadas', async () => {
    const respuesta = await request(app)
      .get('/api/v1/orders/mios?pagina=2')
      .set('Authorization', cliente);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveProperty('pedidos');
    expect(ordersService.listarMios).toHaveBeenCalledWith(7, {
      buscar: undefined,
      estado: 'todos',
      orden: 'recientes',
      desde: undefined,
      hasta: undefined,
      pagina: 2,
      porPagina: 6,
    });
  });

  it('traslada los filtros de la URL', async () => {
    await request(app)
      .get('/api/v1/orders/mios?buscar=caja&estado=pendiente&orden=antiguos&desde=2026-01-01&hasta=2026-06-30')
      .set('Authorization', cliente);

    expect(ordersService.listarMios).toHaveBeenCalledWith(7, {
      buscar: 'caja',
      estado: 'pendiente',
      orden: 'antiguos',
      desde: '2026-01-01',
      hasta: '2026-06-30',
      pagina: 1,
      porPagina: 6,
    });
  });

  it('un filtro invalido cae al valor por defecto en vez de fallar', async () => {
    const respuesta = await request(app)
      .get('/api/v1/orders/mios?estado=loquesea&pagina=abc')
      .set('Authorization', cliente);

    expect(respuesta.status).toBe(200);
    expect(ordersService.listarMios).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ estado: 'todos', pagina: 1 })
    );
  });

  // Un rango de fechas al reves si se rechaza: es un error del formulario
  it('rechaza un rango de fechas invertido', async () => {
    const respuesta = await request(app)
      .get('/api/v1/orders/mios?desde=2026-06-30&hasta=2026-01-01')
      .set('Authorization', cliente);

    expect(respuesta.status).toBe(400);
  });

  it('propaga el conflicto de stock del servicio', async () => {
    vi.mocked(ordersService.crear).mockRejectedValue(
      new AppError('Solo quedan 2 unidades de "Caja"', 409)
    );

    const respuesta = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', cliente)
      .send(cuerpo);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatch(/solo quedan 2/i);
  });
});
