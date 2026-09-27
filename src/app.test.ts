import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { rmSync } from 'fs';

// La carpeta de subidas se fija antes de importar la app, que lee env al cargarse
const { carpetaSubidas } = await vi.hoisted(async () => {
  const os = await import('os');
  const ruta = await import('path');
  const fs = await import('fs');
  const carpeta = fs.mkdtempSync(ruta.join(os.tmpdir(), 'hycon-app-test-'));
  process.env.UPLOADS_DIR = carpeta;
  process.env.PUBLIC_URL = 'http://localhost:4000';
  return { carpetaSubidas: carpeta };
});

// Las rutas se prueban sin base de datos: el servicio se sustituye
vi.mock('./modules/catalog/catalog.service', () => ({
  catalogService: {
    listarProductos: vi.fn(),
    obtenerProducto: vi.fn(),
    crearProducto: vi.fn(),
    actualizarProducto: vi.fn(),
    eliminarProducto: vi.fn(),
    listarCursos: vi.fn(),
    obtenerCurso: vi.fn(),
    crearCurso: vi.fn(),
    actualizarCurso: vi.fn(),
    eliminarCurso: vi.fn(),
  },
}));

import { app } from './app';
import { firmarToken } from './core/utils/jwt';
import { catalogService } from './modules/catalog/catalog.service';
import { AppError } from './core/errors/AppError';

const tokenAdmin = `Bearer ${firmarToken({ userId: 1, email: 'info@hycon.lat', rol: 'ADMIN' })}`;
const tokenCliente = `Bearer ${firmarToken({ userId: 2, email: 'c@hycon.com', rol: 'CLIENTE' })}`;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const productoValido = { name: 'Caja de carton', price: '25.90', shippingAgencies: ['olva'] };
const paginacion = { pagina: 1, porPagina: 6, total: 0, totalPaginas: 1 };

afterAll(() => {
  rmSync(carpetaSubidas, { recursive: true, force: true });
});

beforeEach(() => {
  vi.mocked(catalogService.listarProductos).mockResolvedValue({ elementos: [], paginacion });
  vi.mocked(catalogService.listarCursos).mockResolvedValue({ elementos: [], paginacion });
});

describe('GET /api/v1/catalog', () => {
  it('lista productos paginados sin sesion y pasa los filtros de la URL', async () => {
    const respuesta = await request(app).get(
      '/api/v1/catalog/products?estado=todos&pagina=2&porPagina=6'
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ productos: [], paginacion });
    expect(catalogService.listarProductos).toHaveBeenCalledWith({
      estado: 'todos',
      pagina: 2,
      porPagina: 6,
    });
  });

  it('un parametro basura no rompe el listado', async () => {
    const respuesta = await request(app).get('/api/v1/catalog/courses?pagina=hola');

    expect(respuesta.status).toBe(200);
    expect(catalogService.listarCursos).toHaveBeenCalledWith({
      estado: 'active',
      pagina: 1,
      porPagina: 6,
    });
  });

  it('expone el catalogo de agencias de envio', async () => {
    const respuesta = await request(app).get('/api/v1/catalog/shipping-agencies');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.agencias).toContainEqual({ code: 'shalom', name: 'Shalom' });
  });

  it('responde 400 si el identificador no es un uuid', async () => {
    const texto = await request(app).get('/api/v1/catalog/products/abc');
    // El correlativo tampoco vale: el catalogo solo se direcciona por uuid
    const correlativo = await request(app).get('/api/v1/catalog/products/1');

    expect(texto.status).toBe(400);
    expect(correlativo.status).toBe(400);
    expect(catalogService.obtenerProducto).not.toHaveBeenCalled();
  });

  it('propaga el 404 del servicio', async () => {
    vi.mocked(catalogService.obtenerProducto).mockRejectedValue(
      new AppError('Producto no encontrado', 404)
    );

    const respuesta = await request(app).get(
      '/api/v1/catalog/products/00000000-0000-4000-8000-000000000999'
    );

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toBe('Producto no encontrado');
  });
});

const UUID = '7b73989c-0719-4c06-bd1e-8c7ae193a432';
const UUID_CURSO = 'b7b299d8-ee8f-4bea-a618-0a5f8261136f';

describe('escrituras del catalogo', () => {
  it.each([
    ['put', `/api/v1/catalog/products/${UUID}`],
    ['delete', `/api/v1/catalog/products/${UUID}`],
    ['put', `/api/v1/catalog/courses/${UUID_CURSO}`],
    ['delete', `/api/v1/catalog/courses/${UUID_CURSO}`],
  ] as const)('%s %s exige sesion', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta).send(productoValido);
    expect(respuesta.status).toBe(401);
  });

  it('un CLIENTE no puede editar ni eliminar', async () => {
    const editar = await request(app)
      .put(`/api/v1/catalog/products/${UUID}`)
      .set('Authorization', tokenCliente)
      .send(productoValido);
    const eliminar = await request(app)
      .delete(`/api/v1/catalog/products/${UUID}`)
      .set('Authorization', tokenCliente);

    expect(editar.status).toBe(403);
    expect(eliminar.status).toBe(403);
    expect(catalogService.actualizarProducto).not.toHaveBeenCalled();
    expect(catalogService.eliminarProducto).not.toHaveBeenCalled();
  });

  it('el ADMIN edita con el cuerpo ya validado y convertido', async () => {
    vi.mocked(catalogService.actualizarProducto).mockResolvedValue({ uuid: UUID } as never);

    const respuesta = await request(app)
      .put(`/api/v1/catalog/products/${UUID}`)
      .set('Authorization', tokenAdmin)
      .send(productoValido);

    expect(respuesta.status).toBe(200);
    expect(catalogService.actualizarProducto).toHaveBeenCalledWith(
      UUID,
      expect.objectContaining({ price: 25.9, stock: 0, shippingAgencies: ['olva'] })
    );
  });

  it('editar con datos invalidos responde 422 sin llegar al servicio', async () => {
    const respuesta = await request(app)
      .put(`/api/v1/catalog/products/${UUID}`)
      .set('Authorization', tokenAdmin)
      .send({ ...productoValido, shippingAgencies: ['inventada'] });

    expect(respuesta.status).toBe(422);
    expect(catalogService.actualizarProducto).not.toHaveBeenCalled();
  });

  it('eliminar responde 204 sin cuerpo', async () => {
    vi.mocked(catalogService.eliminarCurso).mockResolvedValue();

    const respuesta = await request(app)
      .delete(`/api/v1/catalog/courses/${UUID_CURSO}`)
      .set('Authorization', tokenAdmin);

    expect(respuesta.status).toBe(204);
    expect(catalogService.eliminarCurso).toHaveBeenCalledWith(UUID_CURSO);
  });

  it('eliminar algo con pedidos devuelve el 409 del servicio', async () => {
    vi.mocked(catalogService.eliminarProducto).mockRejectedValue(
      new AppError('Este producto ya tiene pedidos', 409)
    );

    const respuesta = await request(app)
      .delete(`/api/v1/catalog/products/${UUID}`)
      .set('Authorization', tokenAdmin);

    expect(respuesta.status).toBe(409);
  });
});

describe('POST /api/v1/uploads/imagenes', () => {
  it('exige sesion de ADMIN', async () => {
    const sinSesion = await request(app)
      .post('/api/v1/uploads/imagenes')
      .attach('imagen', PNG, 'caja.png');
    const cliente = await request(app)
      .post('/api/v1/uploads/imagenes')
      .set('Authorization', tokenCliente)
      .attach('imagen', PNG, 'caja.png');

    expect(sinSesion.status).toBe(401);
    expect(cliente.status).toBe(403);
  });

  it('guarda la imagen y la sirve con permiso para otro origen', async () => {
    const subida = await request(app)
      .post('/api/v1/uploads/imagenes')
      .set('Authorization', tokenAdmin)
      .attach('imagen', PNG, 'caja.png');

    expect(subida.status).toBe(201);
    const { url } = subida.body.data.imagen;
    expect(url).toMatch(/^http:\/\/localhost:4000\/uploads\/imagenes\/.+\.png$/);

    const servida = await request(app).get(new URL(url).pathname);
    expect(servida.status).toBe(200);
    expect(servida.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('rechaza un archivo que no es imagen aunque diga .png', async () => {
    const respuesta = await request(app)
      .post('/api/v1/uploads/imagenes')
      .set('Authorization', tokenAdmin)
      .attach('imagen', Buffer.from('<script>alert(1)</script>'), {
        filename: 'falsa.png',
        contentType: 'image/png',
      });

    expect(respuesta.status).toBe(415);
  });

  it('pide el archivo si no llega ninguno', async () => {
    const respuesta = await request(app)
      .post('/api/v1/uploads/imagenes')
      .set('Authorization', tokenAdmin);

    expect(respuesta.status).toBe(400);
  });

  it('rechaza imagenes de mas de 5 MB', async () => {
    const enorme = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);

    const respuesta = await request(app)
      .post('/api/v1/uploads/imagenes')
      .set('Authorization', tokenAdmin)
      .attach('imagen', enorme, 'enorme.png');

    expect(respuesta.status).toBe(413);
  });
});

describe('documentacion', () => {
  it('describe en OpenAPI todas las rutas del catalogo y la subida', async () => {
    const { openApiSpec } = await import('./core/config/openapi');
    const rutas = Object.keys(openApiSpec.paths);

    expect(rutas).toEqual(
      expect.arrayContaining([
        '/catalog/shipping-agencies',
        '/catalog/products',
        '/catalog/products/{uuid}',
        '/catalog/courses',
        '/catalog/courses/{uuid}',
        '/uploads/imagenes',
        '/posts',
        '/posts/{referencia}',
      ])
    );
    const paths = openApiSpec.paths as Record<string, object>;
    expect(Object.keys(paths['/catalog/products/{uuid}'])).toEqual(
      expect.arrayContaining(['get', 'put', 'delete'])
    );
  });
});
