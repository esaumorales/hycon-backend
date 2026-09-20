import { env } from './env';
import { AGENCIAS_ENVIO, CODIGOS_AGENCIA, POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO } from '../../modules/catalog/catalog.constants';

// ---------------------------------------------------------------------------
// Esquemas reutilizables
// ---------------------------------------------------------------------------

const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` });

// Todas las respuestas correctas llegan envueltas en { success, data }
const sobre = (data: object, descripcion: string) => ({
  description: descripcion,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data,
        },
      },
    },
  },
});

const error = (descripcion: string) => ({
  description: descripcion,
  content: { 'application/json': { schema: ref('Error') } },
});

const ERRORES_ADMIN = {
  '401': error('Falta el token o no es valido'),
  '403': error('La cuenta no tiene rol ADMIN'),
};

const parametroId = (entidad: string) => ({
  name: 'id',
  in: 'path',
  required: true,
  description: `Identificador del ${entidad}`,
  schema: { type: 'integer', minimum: 1, example: 1 },
});

const PARAMETROS_LISTADO = [
  {
    name: 'estado',
    in: 'query',
    description:
      'Filtra por estado. El catalogo publico usa `active` (por defecto); el panel pide `todos`. Un valor invalido se ignora.',
    schema: { type: 'string', enum: ['active', 'inactive', 'todos'], default: 'active' },
  },
  {
    name: 'pagina',
    in: 'query',
    description: 'Numero de pagina, empezando en 1. Un valor invalido vuelve a 1.',
    schema: { type: 'integer', minimum: 1, default: 1 },
  },
  {
    name: 'porPagina',
    in: 'query',
    description: `Filas por pagina, entre 1 y ${POR_PAGINA_MAXIMO}.`,
    schema: { type: 'integer', minimum: 1, maximum: POR_PAGINA_MAXIMO, default: POR_PAGINA_DEFECTO },
  },
];

const cuerpoJson = (esquema: string) => ({
  required: true,
  content: { 'application/json': { schema: ref(esquema) } },
});

const usuarioSchema = {
  type: 'object',
  properties: {
    userId: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Esau' },
    lastname: { type: 'string', example: 'Morales' },
    email: { type: 'string', example: 'info@hycon.lat' },
    phone: { type: 'string', nullable: true },
    avatarUrl: { type: 'string', nullable: true },
    roleId: { type: 'integer', example: 1 },
    rol: { type: 'string', example: 'ADMIN' },
  },
};

const schemas = {
  Error: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: { type: 'string', example: 'price: El precio debe ser mayor que cero' },
    },
  },
  Usuario: usuarioSchema,
  Sesion: {
    type: 'object',
    description:
      'El token de acceso dura poco y se envia en Authorization: Bearer. La sesion larga NO va en el cuerpo: llega en la cookie httpOnly hycon_sesion (Path=/api/v1/auth), inaccesible desde JavaScript.',
    properties: {
      token: { type: 'string', description: 'JWT de acceso (HS256, emisor hycon-api)' },
      expiraEn: { type: 'integer', description: 'Segundos de vida del token de acceso', example: 900 },
      usuario: ref('Usuario'),
    },
  },
  ErrorBloqueo: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'string',
        example: 'Demasiados intentos fallidos. Por seguridad el acceso esta bloqueado. Intenta de nuevo en 14 min',
      },
      reintentarEnSegundos: { type: 'integer', example: 840 },
    },
  },
  Paginacion: {
    type: 'object',
    properties: {
      pagina: { type: 'integer', example: 1 },
      porPagina: { type: 'integer', example: POR_PAGINA_DEFECTO },
      total: { type: 'integer', example: 14 },
      totalPaginas: { type: 'integer', example: 3 },
    },
  },
  AgenciaEnvio: {
    type: 'object',
    properties: {
      code: { type: 'string', enum: CODIGOS_AGENCIA, example: 'shalom' },
      name: { type: 'string', example: 'Shalom' },
    },
  },
  Producto: {
    type: 'object',
    properties: {
      productId: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Silla ergonomica Pro' },
      description: { type: 'string', nullable: true },
      brand: { type: 'string', nullable: true, example: 'Hycon' },
      model: { type: 'string', nullable: true, example: 'SE-200' },
      color: { type: 'string', nullable: true, example: 'Negro' },
      price: { type: 'number', example: 459.9 },
      discountPrice: { type: 'number', nullable: true, example: 399.9 },
      stock: { type: 'integer', description: 'Cantidad disponible', example: 12 },
      shippingAgencies: { type: 'array', items: ref('AgenciaEnvio') },
      status: { type: 'string', enum: ['active', 'inactive'] },
      imageUrl: { type: 'string', nullable: true, example: `${env.PUBLIC_URL}/uploads/imagenes/9f1c.webp` },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  ProductoEntrada: {
    type: 'object',
    description:
      'Crear y editar usan el mismo cuerpo. Al editar se envia el registro completo: un campo opcional vacio o ausente deja la columna en NULL.',
    required: ['name', 'price'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 200, example: 'Silla ergonomica Pro' },
      brand: { type: 'string', maxLength: 100, example: 'Hycon' },
      model: { type: 'string', maxLength: 100, example: 'SE-200' },
      color: { type: 'string', maxLength: 50, example: 'Negro' },
      price: { type: 'number', exclusiveMinimum: 0, example: 459.9 },
      discountPrice: {
        type: 'number',
        exclusiveMinimum: 0,
        description: 'Debe ser menor que price',
        example: 399.9,
      },
      stock: { type: 'integer', minimum: 0, default: 0, description: 'Cantidad disponible', example: 12 },
      shippingAgencies: {
        type: 'array',
        description: `Codigos de agencia. Validos: ${AGENCIAS_ENVIO.map((a) => `\`${a.code}\` (${a.name})`).join(', ')}. Los repetidos se eliminan.`,
        items: { type: 'string', enum: CODIGOS_AGENCIA },
        default: [],
        example: ['shalom', 'olva'],
      },
      description: { type: 'string', maxLength: 2000 },
      status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
      imageUrl: {
        type: 'string',
        format: 'uri',
        description:
          'Imagen principal. Puede ser una URL externa o la devuelta por POST /uploads/imagenes. Al reemplazarla, la anterior subida al servidor se borra del disco.',
      },
    },
  },
  Curso: {
    type: 'object',
    properties: {
      courseId: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Pausas activas en oficina' },
      description: { type: 'string', nullable: true },
      videoUrl: { type: 'string', nullable: true, example: 'https://youtu.be/dQw4w9WgXcQ' },
      youtubeId: {
        type: 'string',
        nullable: true,
        description:
          'Id del video extraido de videoUrl, para incrustarlo con https://www.youtube-nocookie.com/embed/{youtubeId}. Null si no hay video.',
        example: 'dQw4w9WgXcQ',
      },
      thumbnailUrl: { type: 'string', nullable: true },
      durationMinutes: { type: 'integer', nullable: true, example: 90 },
      price: { type: 'number', example: 120 },
      discountPrice: { type: 'number', nullable: true, example: 99 },
      status: { type: 'string', enum: ['active', 'inactive'] },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  CursoEntrada: {
    type: 'object',
    description: 'Crear y editar usan el mismo cuerpo completo.',
    required: ['name', 'price'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 200, example: 'Pausas activas en oficina' },
      description: { type: 'string', maxLength: 2000 },
      videoUrl: {
        type: 'string',
        format: 'uri',
        description:
          'Solo links de YouTube: watch?v=, youtu.be/, shorts/, embed/ o live/. El video se reproduce dentro de la web.',
        example: 'https://youtu.be/dQw4w9WgXcQ',
      },
      thumbnailUrl: {
        type: 'string',
        format: 'uri',
        description: 'URL externa o devuelta por POST /uploads/imagenes',
      },
      durationMinutes: { type: 'integer', minimum: 1, example: 90 },
      price: { type: 'number', exclusiveMinimum: 0, example: 120 },
      discountPrice: { type: 'number', exclusiveMinimum: 0, example: 99 },
      status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
    },
  },
  Publicacion: {
    type: 'object',
    properties: {
      postId: { type: 'integer', example: 1 },
      title: { type: 'string', example: 'Pausas activas en la oficina' },
      slug: {
        type: 'string',
        description: 'Generado desde el titulo; unico. Solo cambia si cambia el titulo.',
        example: 'pausas-activas-en-la-oficina',
      },
      excerpt: { type: 'string', nullable: true, example: 'Cinco ejercicios de dos minutos.' },
      content: {
        type: 'string',
        description: 'Cuerpo del articulo en HTML ya limpio, listo para mostrar.',
        example: '<h2>Por que importa</h2><p>Texto con <strong>negrita</strong>.</p><ul><li><p>Punto</p></li></ul>',
      },
      coverUrl: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['active', 'inactive'], description: 'active: publicado; inactive: borrador' },
      views: { type: 'integer', description: 'Lecturas, para "Lo mas leido"', example: 120 },
      readingMinutes: { type: 'integer', description: 'Calculado a 200 palabras por minuto', example: 4 },
      authorName: { type: 'string', example: 'Esau Morales' },
      publishedAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  PublicacionEntrada: {
    type: 'object',
    description: 'Crear y editar usan el mismo cuerpo completo.',
    required: ['title', 'content'],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 200, example: 'Pausas activas en la oficina' },
      excerpt: { type: 'string', maxLength: 300, description: 'Resumen para las tarjetas del listado' },
      content: {
        type: 'string',
        maxLength: 50000,
        description:
          'HTML del editor. Etiquetas permitidas: p, br, strong, b, em, i, u, s, h2, h3, ul, ol, li, blockquote, a (href http/https/mailto), hr. Todo lo demas se elimina al guardar (scripts, estilos, atributos on*). Un h1 se convierte en h2. Tambien acepta texto plano: cada bloque separado por una linea en blanco se guarda como parrafo. Minimo 20 caracteres de texto visible.',
      },
      coverUrl: { type: 'string', format: 'uri', description: 'URL externa o devuelta por POST /uploads/imagenes' },
      status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
      publishedAt: {
        type: 'string',
        format: 'date',
        description: 'YYYY-MM-DD. Al crear sin fecha se usa hoy; al editar sin fecha se conserva la anterior.',
        example: '2026-03-01',
      },
    },
  },
  ImagenSubida: {
    type: 'object',
    properties: {
      url: { type: 'string', example: `${env.PUBLIC_URL}/uploads/imagenes/2b7e1c0a-5d7f-4b8e-9d0a-3f1e2c4b5a6d.webp` },
      tipo: { type: 'string', enum: ['jpg', 'png', 'webp', 'gif'] },
      bytes: { type: 'integer', example: 184233 },
    },
  },
};

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

// Genera las cinco operaciones CRUD de una entidad del catalogo
const rutasCrud = (opciones: {
  ruta: string;
  entidad: string;
  plural: string;
  esquema: string;
  claveUno: string;
  claveLista: string;
  conflicto: string;
}) => ({
  [`/catalog/${opciones.ruta}`]: {
    get: {
      tags: ['Catalogo'],
      summary: `Lista ${opciones.plural} paginados`,
      description: `Publico. Ordenado del mas reciente al mas antiguo. Devuelve ${POR_PAGINA_DEFECTO} por pagina salvo que se indique porPagina.`,
      parameters: PARAMETROS_LISTADO,
      responses: {
        '200': sobre(
          {
            type: 'object',
            properties: {
              [opciones.claveLista]: { type: 'array', items: ref(opciones.esquema) },
              paginacion: ref('Paginacion'),
            },
          },
          `Pagina de ${opciones.plural}`
        ),
      },
    },
    post: {
      tags: ['Catalogo'],
      summary: `Crea un ${opciones.entidad} (solo ADMIN)`,
      description: 'El propietario se toma del token, nunca del cuerpo.',
      security: [{ bearerAuth: [] }],
      requestBody: cuerpoJson(`${opciones.esquema}Entrada`),
      responses: {
        '201': sobre(
          { type: 'object', properties: { [opciones.claveUno]: ref(opciones.esquema) } },
          `${opciones.entidad} creado`
        ),
        ...ERRORES_ADMIN,
        '422': error('Datos invalidos: el mensaje indica el campo'),
      },
    },
  },
  [`/catalog/${opciones.ruta}/{id}`]: {
    get: {
      tags: ['Catalogo'],
      summary: `Obtiene un ${opciones.entidad}`,
      parameters: [parametroId(opciones.entidad)],
      responses: {
        '200': sobre(
          { type: 'object', properties: { [opciones.claveUno]: ref(opciones.esquema) } },
          `${opciones.entidad} encontrado`
        ),
        '400': error('El id no es un entero positivo'),
        '404': error(`No existe el ${opciones.entidad}`),
      },
    },
    put: {
      tags: ['Catalogo'],
      summary: `Edita un ${opciones.entidad} (solo ADMIN)`,
      description: 'Reemplaza el registro completo con el cuerpo enviado.',
      security: [{ bearerAuth: [] }],
      parameters: [parametroId(opciones.entidad)],
      requestBody: cuerpoJson(`${opciones.esquema}Entrada`),
      responses: {
        '200': sobre(
          { type: 'object', properties: { [opciones.claveUno]: ref(opciones.esquema) } },
          `${opciones.entidad} actualizado`
        ),
        '400': error('El id no es un entero positivo'),
        ...ERRORES_ADMIN,
        '404': error(`No existe el ${opciones.entidad}`),
        '422': error('Datos invalidos: el mensaje indica el campo'),
      },
    },
    delete: {
      tags: ['Catalogo'],
      summary: `Elimina un ${opciones.entidad} (solo ADMIN)`,
      description: `Borrado definitivo, incluidas sus imagenes subidas al servidor. ${opciones.conflicto}`,
      security: [{ bearerAuth: [] }],
      parameters: [parametroId(opciones.entidad)],
      responses: {
        '204': { description: 'Eliminado. Sin cuerpo' },
        '400': error('El id no es un entero positivo'),
        ...ERRORES_ADMIN,
        '404': error(`No existe el ${opciones.entidad}`),
        '409': error('Tiene registros asociados; desactivalo en lugar de eliminarlo'),
      },
    },
  },
});

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Hycon API',
    version: '1.1.0',
    description:
      'Documentacion interactiva del backend de Hycon.\n\nLas respuestas correctas llegan como `{ success: true, data }` y los errores como `{ success: false, error }`. Para las rutas de ADMIN inicia sesion en **POST /auth/login** y pega el token en el boton de autenticacion. El token de acceso dura 15 minutos.',
  },
  servers: [{ url: `${env.PUBLIC_URL}/api/v1`, description: 'Servidor configurado en PUBLIC_URL' }],
  tags: [
    { name: 'Auth', description: 'Registro, inicio de sesion y usuario actual' },
    { name: 'Catalogo', description: 'Productos, cursos y agencias de envio' },
    { name: 'Publicaciones', description: 'Articulos del blog' },
    { name: 'Archivos', description: 'Subida de imagenes para el catalogo y las publicaciones' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas,
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registra una cuenta nueva con rol CLIENTE e inicia sesion',
        description:
          'Politica de contrasenas (NIST SP 800-63B / OWASP ASVS 2.1): minimo 12 y maximo 128 caracteres, sin reglas de composicion obligatorias. Se rechazan contrasenas comunes o filtradas (tambien con numeros o signos al final), repeticiones, secuencias y las que contienen el nombre, el apellido o el correo. Se guarda con bcrypt (coste 12).',
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
                  password: { type: 'string', minLength: 12, maxLength: 128, example: 'cafe con leche en el misti' },
                  phone: { type: 'string', example: '999888777' },
                  recordar: { type: 'boolean', default: false, description: 'Mantener la sesion 30 dias' },
                },
              },
            },
          },
        },
        responses: {
          '201': sobre(ref('Sesion'), 'Cuenta creada, sesion iniciada y cookie hycon_sesion enviada'),
          '409': error('El correo ya esta registrado'),
          '422': error('Datos invalidos o contrasena que no cumple la politica'),
          '429': error('Demasiadas solicitudes desde la misma IP'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Inicia sesion',
        description:
          'Proteccion contra fuerza bruta: tras LOGIN_MAX_INTENTOS fallos seguidos (5 por defecto) el acceso se bloquea LOGIN_BLOQUEO_MINUTOS (15). El bloqueo se aplica igual a correos inexistentes, y el mensaje de error es el mismo exista o no la cuenta, para no revelar que correos estan registrados. Ademas hay un limite de peticiones por IP. Cada intento queda en el registro de auditoria (auth_events) con IP y navegador, nunca con la contrasena.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'info@hycon.lat' },
                  password: { type: 'string', example: '123456' },
                  recordar: {
                    type: 'boolean',
                    default: false,
                    description: 'true: sesion de 30 dias. false: la cookie se borra al cerrar el navegador (maximo 12 h)',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': sobre(ref('Sesion'), 'Sesion iniciada y cookie hycon_sesion enviada'),
          '401': error('Correo o contrasena incorrectos'),
          '422': error('Datos invalidos'),
          '429': {
            description: 'Acceso bloqueado por intentos fallidos. Incluye la cabecera Retry-After',
            content: { 'application/json': { schema: ref('ErrorBloqueo') } },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renueva el token de acceso con la cookie de sesion',
        description:
          'Usa la cookie hycon_sesion (enviar con credentials: include). Cada uso rota la sesion: el token anterior deja de valer y llega uno nuevo en la cookie. Si un token ya rotado se vuelve a usar se considera robado y se cierran todas las sesiones de esa familia. Solo acepta peticiones desde los origenes de CORS_ORIGINS (proteccion CSRF). La rotacion no amplia la duracion maxima de la sesion.',
        responses: {
          '200': sobre(ref('Sesion'), 'Token renovado'),
          '401': error('Sesion inexistente, caducada o revocada'),
          '403': error('Origen no permitido'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cierra la sesion',
        description: 'Revoca la sesion en el servidor (no basta con olvidar el token) y borra la cookie.',
        responses: {
          '204': { description: 'Sesion cerrada' },
          '403': error('Origen no permitido'),
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Devuelve el usuario de la sesion activa',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': sobre({ type: 'object', properties: { usuario: ref('Usuario') } }, 'Usuario autenticado'),
          '401': error('Falta el token, no es valido o expiro'),
        },
      },
    },
    '/catalog/shipping-agencies': {
      get: {
        tags: ['Catalogo'],
        summary: 'Lista las agencias de envio disponibles',
        description: 'Publico. Son los unicos codigos que acepta shippingAgencies al crear o editar un producto.',
        responses: {
          '200': sobre(
            { type: 'object', properties: { agencias: { type: 'array', items: ref('AgenciaEnvio') } } },
            'Agencias de envio'
          ),
        },
      },
    },
    ...rutasCrud({
      ruta: 'products',
      entidad: 'producto',
      plural: 'productos',
      esquema: 'Producto',
      claveUno: 'producto',
      claveLista: 'productos',
      conflicto: 'Si ya aparece en pedidos o carritos la base lo impide y se responde 409.',
    }),
    ...rutasCrud({
      ruta: 'courses',
      entidad: 'curso',
      plural: 'cursos',
      esquema: 'Curso',
      claveUno: 'curso',
      claveLista: 'cursos',
      conflicto: 'Si ya tiene matriculas, pedidos o certificados se responde 409.',
    }),
    '/posts': {
      get: {
        tags: ['Publicaciones'],
        summary: 'Lista publicaciones paginadas',
        description: `Publico. Ordenadas por fecha de publicacion, de la mas reciente a la mas antigua. ${POR_PAGINA_DEFECTO} por pagina por defecto.`,
        parameters: PARAMETROS_LISTADO,
        responses: {
          '200': sobre(
            {
              type: 'object',
              properties: {
                publicaciones: { type: 'array', items: ref('Publicacion') },
                paginacion: ref('Paginacion'),
              },
            },
            'Pagina de publicaciones'
          ),
        },
      },
      post: {
        tags: ['Publicaciones'],
        summary: 'Crea una publicacion (solo ADMIN)',
        description: 'El autor se toma del token. El slug se genera desde el titulo y se numera si ya existe.',
        security: [{ bearerAuth: [] }],
        requestBody: cuerpoJson('PublicacionEntrada'),
        responses: {
          '201': sobre({ type: 'object', properties: { publicacion: ref('Publicacion') } }, 'Publicacion creada'),
          ...ERRORES_ADMIN,
          '422': error('Datos invalidos: el mensaje indica el campo'),
        },
      },
    },
    '/posts/{id}': {
      get: {
        tags: ['Publicaciones'],
        summary: 'Obtiene una publicacion',
        parameters: [parametroId('articulo')],
        responses: {
          '200': sobre({ type: 'object', properties: { publicacion: ref('Publicacion') } }, 'Publicacion encontrada'),
          '400': error('El id no es un entero positivo'),
          '404': error('No existe la publicacion'),
        },
      },
      put: {
        tags: ['Publicaciones'],
        summary: 'Edita una publicacion (solo ADMIN)',
        description: 'Si se reemplaza la portada, la anterior subida al servidor se borra del disco.',
        security: [{ bearerAuth: [] }],
        parameters: [parametroId('articulo')],
        requestBody: cuerpoJson('PublicacionEntrada'),
        responses: {
          '200': sobre({ type: 'object', properties: { publicacion: ref('Publicacion') } }, 'Publicacion actualizada'),
          '400': error('El id no es un entero positivo'),
          ...ERRORES_ADMIN,
          '404': error('No existe la publicacion'),
          '422': error('Datos invalidos: el mensaje indica el campo'),
        },
      },
      delete: {
        tags: ['Publicaciones'],
        summary: 'Elimina una publicacion (solo ADMIN)',
        description: 'Borrado definitivo, incluida su portada subida al servidor.',
        security: [{ bearerAuth: [] }],
        parameters: [parametroId('articulo')],
        responses: {
          '204': { description: 'Eliminada. Sin cuerpo' },
          '400': error('El id no es un entero positivo'),
          ...ERRORES_ADMIN,
          '404': error('No existe la publicacion'),
        },
      },
    },
    '/uploads/imagenes': {
      post: {
        tags: ['Archivos'],
        summary: 'Sube una imagen (solo ADMIN)',
        description:
          'Acepta JPG, PNG, WEBP o GIF de hasta 5 MB. El formato se comprueba por la firma del archivo, no por la extension. Devuelve la URL publica para usarla como imageUrl o thumbnailUrl.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['imagen'],
                properties: { imagen: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          '201': sobre({ type: 'object', properties: { imagen: ref('ImagenSubida') } }, 'Imagen guardada'),
          '400': error('No se adjunto el archivo en el campo imagen'),
          ...ERRORES_ADMIN,
          '413': error('La imagen supera 5 MB'),
          '415': error('El archivo no es una imagen permitida'),
        },
      },
    },
  },
};
