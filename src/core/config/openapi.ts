import { env } from './env';

const usuarioSchema = {
  type: 'object',
  properties: {
    userId: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Esau' },
    lastname: { type: 'string', example: 'Morales' },
    email: { type: 'string', example: 'admin@hycon.com' },
    phone: { type: 'string', nullable: true },
    avatarUrl: { type: 'string', nullable: true },
    roleId: { type: 'integer', example: 1 },
    rol: { type: 'string', example: 'ADMIN' },
  },
};

const sesionSchema = {
  type: 'object',
  properties: {
    token: { type: 'string' },
    usuario: usuarioSchema,
  },
};

const respuestaError = {
  description: 'Error',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
    },
  },
};

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Hycon API',
    version: '1.0.0',
    description: 'Documentacion interactiva de la API para el backend de Hycon.',
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}/api/v1`,
      description: 'Servidor Local de Desarrollo',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registra una cuenta nueva con rol CLIENTE',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'lastname', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Ana' },
                  lastname: { type: 'string', example: 'Quispe' },
                  email: { type: 'string', example: 'ana@hycon.com' },
                  password: { type: 'string', example: 'Cliente2026' },
                  phone: { type: 'string', example: '999888777' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Cuenta creada y sesion iniciada',
            content: { 'application/json': { schema: sesionSchema } },
          },
          '409': respuestaError,
          '422': respuestaError,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Inicia sesion y devuelve el token JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@hycon.com' },
                  password: { type: 'string', example: 'Hycon2026' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sesion iniciada',
            content: { 'application/json': { schema: sesionSchema } },
          },
          '401': respuestaError,
        },
      },
    },
    '/catalog/products': {
      get: {
        tags: ['Catalogo'],
        summary: 'Lista los productos publicados',
        responses: { '200': { description: 'Listado de productos' } },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Crea un producto (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  name: { type: 'string', example: 'Caja de carton 40x40' },
                  description: { type: 'string' },
                  brand: { type: 'string', example: 'Hycon' },
                  model: { type: 'string', example: 'C-40' },
                  price: { type: 'number', example: 25.9 },
                  discountPrice: { type: 'number', example: 19.9 },
                  stock: { type: 'integer', example: 12 },
                  status: { type: 'string', enum: ['active', 'inactive'] },
                  imageUrl: { type: 'string', example: 'https://cdn.hycon.lat/caja.webp' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Producto creado' },
          '401': respuestaError,
          '403': respuestaError,
          '422': respuestaError,
        },
      },
    },
    '/catalog/courses': {
      get: {
        tags: ['Catalogo'],
        summary: 'Lista los cursos publicados',
        responses: { '200': { description: 'Listado de cursos' } },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Crea un curso (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  name: { type: 'string', example: 'Logistica de ultima milla' },
                  description: { type: 'string' },
                  videoUrl: { type: 'string', example: 'https://youtu.be/abc' },
                  thumbnailUrl: { type: 'string' },
                  durationMinutes: { type: 'integer', example: 90 },
                  price: { type: 'number', example: 120 },
                  discountPrice: { type: 'number', example: 99 },
                  status: { type: 'string', enum: ['active', 'inactive'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Curso creado' },
          '401': respuestaError,
          '403': respuestaError,
          '422': respuestaError,
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Devuelve el usuario de la sesion activa',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Usuario autenticado',
            content: { 'application/json': { schema: usuarioSchema } },
          },
          '401': respuestaError,
        },
      },
    },
  },
};
