import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Las rutas se prueban sin base de datos: el servicio se sustituye
vi.mock('./posts.service', () => ({
  postsService: {
    listar: vi.fn(),
    obtener: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
  },
}));

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';
import { AppError } from '../../core/errors/AppError';
import { postsService } from './posts.service';

const admin = `Bearer ${firmarToken({ userId: 1, email: 'info@hycon.lat', rol: 'ADMIN' })}`;
const cliente = `Bearer ${firmarToken({ userId: 2, email: 'c@hycon.com', rol: 'CLIENTE' })}`;
const cuerpo = {
  title: 'Pausas activas',
  content: 'Contenido suficientemente largo para validar.',
  publishedAt: '2026-03-01',
};

describe('/api/v1/posts', () => {
  beforeEach(() => {
    vi.mocked(postsService.listar).mockResolvedValue({
      elementos: [],
      paginacion: { pagina: 1, porPagina: 6, total: 0, totalPaginas: 1 },
    });
  });

  it('lista sin sesion con los filtros de la URL', async () => {
    const respuesta = await request(app).get('/api/v1/posts?estado=todos&pagina=3');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveProperty('publicaciones');
    expect(postsService.listar).toHaveBeenCalledWith({ estado: 'todos', pagina: 3, porPagina: 6 });
  });

  it('crear, editar y eliminar exigen sesion de ADMIN', async () => {
    const sinSesion = await request(app).post('/api/v1/posts').send(cuerpo);
    const comoCliente = await request(app).put('/api/v1/posts/1').set('Authorization', cliente).send(cuerpo);
    const borrarCliente = await request(app).delete('/api/v1/posts/1').set('Authorization', cliente);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(borrarCliente.status).toBe(403);
    expect(postsService.crear).not.toHaveBeenCalled();
  });

  it('el ADMIN crea con el cuerpo validado y su id como autor', async () => {
    vi.mocked(postsService.crear).mockResolvedValue({ postId: 1 } as never);

    const respuesta = await request(app).post('/api/v1/posts').set('Authorization', admin).send(cuerpo);

    expect(respuesta.status).toBe(201);
    expect(postsService.crear).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pausas activas', status: 'active', publishedAt: expect.any(Date) }),
      1
    );
  });

  it('un cuerpo invalido responde 422 indicando el campo', async () => {
    const respuesta = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', admin)
      .send({ ...cuerpo, content: 'corto' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error).toMatch(/^content:/);
  });

  it('editar y eliminar usan el id de la URL', async () => {
    vi.mocked(postsService.actualizar).mockResolvedValue({ postId: 5 } as never);
    vi.mocked(postsService.eliminar).mockResolvedValue();

    const editar = await request(app).put('/api/v1/posts/5').set('Authorization', admin).send(cuerpo);
    const eliminar = await request(app).delete('/api/v1/posts/5').set('Authorization', admin);

    expect(editar.status).toBe(200);
    expect(postsService.actualizar).toHaveBeenCalledWith(5, expect.any(Object));
    expect(eliminar.status).toBe(204);
    expect(postsService.eliminar).toHaveBeenCalledWith(5);
  });

  it('id invalido responde 400 y uno inexistente 404', async () => {
    vi.mocked(postsService.obtener).mockRejectedValue(new AppError('Publicacion no encontrada', 404));

    expect((await request(app).get('/api/v1/posts/abc')).status).toBe(400);
    expect((await request(app).get('/api/v1/posts/99')).status).toBe(404);
  });
});
