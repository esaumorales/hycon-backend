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

// El catalogo se direcciona por uuid: el correlativo no sale de la base
const parametroUuid = (entidad: string) => ({
  name: 'uuid',
  in: 'path',
  required: true,
  description: `Identificador publico del ${entidad}`,
  schema: { type: 'string', format: 'uuid', example: '7b73989c-0719-4c06-bd1e-8c7ae193a432' },
});

const PARAMETROS_LISTADO = [
  { name: 'buscar', in: 'query', description: 'Búsqueda parcial sin distinguir mayúsculas; hasta 120 caracteres.', schema: { type: 'string', maxLength: 120 } },
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
      uuid: {
        type: 'string',
        format: 'uuid',
        description: 'Identificador publico del producto: es el que se usa en las URLs',
        example: '7b73989c-0719-4c06-bd1e-8c7ae193a432',
      },
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
      uuid: {
        type: 'string',
        format: 'uuid',
        description: 'Identificador publico del curso: es el que se usa en las URLs',
        example: 'b7b299d8-ee8f-4bea-a618-0a5f8261136f',
      },
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
      previewSegundos: {
        type: 'integer',
        description: 'Segundos de la leccion de muestra que ve quien no ha comprado el curso',
        example: 60,
      },
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
  Leccion: {
    type: 'object',
    properties: {
      uuid: { type: 'string', format: 'uuid' },
      titulo: { type: 'string', example: 'Introduccion al metodo' },
      descripcion: { type: 'string', nullable: true },
      duracionMinutos: { type: 'integer', nullable: true, example: 8 },
      posicion: { type: 'integer', example: 1 },
      esMuestra: { type: 'boolean', description: 'La unica leccion que ve quien no ha comprado' },
      bloqueada: { type: 'boolean', description: 'true cuando hay que comprar el curso para verla' },
      videoUrl: {
        type: 'string',
        nullable: true,
        description: 'Solo llega si quien pregunta puede ver la leccion; si no, es null',
      },
      youtubeId: { type: 'string', nullable: true },
      limiteSegundos: {
        type: 'integer',
        nullable: true,
        description: 'Segundos que se dejan ver de la muestra. null cuando se puede ver entera',
        example: 60,
      },
    },
  },
  Temario: {
    type: 'object',
    properties: {
      cursoUuid: { type: 'string', format: 'uuid' },
      tieneAcceso: { type: 'boolean', description: 'Si el usuario de la sesion compro el curso' },
      previewSegundos: { type: 'integer', example: 60 },
      lecciones: { type: 'array', items: ref('Leccion') },
    },
  },
  LeccionEntrada: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 2, maxLength: 200, example: 'Introduccion al metodo' },
      description: { type: 'string', maxLength: 2000 },
      videoUrl: { type: 'string', description: 'Link de YouTube de esta parte del curso' },
      durationMinutes: { type: 'integer', minimum: 1, maximum: 1000, example: 8 },
      esMuestra: {
        type: 'boolean',
        default: false,
        description:
          'Marca la leccion gratuita. Solo puede haber una por curso: al marcar otra, la anterior se desmarca.',
      },
    },
  },
  CursoComprado: {
    type: 'object',
    properties: {
      uuid: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Logistica de ultima milla' },
      description: { type: 'string', nullable: true },
      videoUrl: { type: 'string', nullable: true },
      youtubeId: { type: 'string', nullable: true, description: 'Id del video para incrustarlo' },
      thumbnailUrl: { type: 'string', nullable: true },
      durationMinutes: { type: 'integer', nullable: true, example: 150 },
      compradoEl: {
        type: 'string',
        format: 'date-time',
        description: 'Fecha del pedido mas reciente que incluye este curso',
      },
    },
  },
  FirmaSubida: {
    type: 'object',
    description:
      'Permiso temporal para subir una imagen a Cloudinary desde el navegador. El api secret nunca sale del servidor.',
    properties: {
      cloudName: { type: 'string', example: 'hycon' },
      apiKey: { type: 'string', example: '123456789012345' },
      timestamp: { type: 'integer', description: 'Momento de la firma, en segundos' },
      folder: { type: 'string', example: 'hycon/catalogo' },
      signature: { type: 'string', description: 'sha1 de los parametros firmados' },
    },
  },
  AvatarEntrada: {
    type: 'object',
    required: ['avatarUrl'],
    properties: {
      avatarUrl: {
        type: 'string',
        format: 'uri',
        maxLength: 500,
        description: 'Direccion que devolvio Cloudinary al subir la foto',
      },
    },
  },
  PerfilEntrada: {
    type: 'object',
    required: ['name', 'lastname'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100, example: 'Ana' },
      lastname: { type: 'string', minLength: 2, maxLength: 100, example: 'Quispe Rojas' },
      phone: {
        type: 'string',
        maxLength: 30,
        description: 'Solo numeros y los signos + ( ) -. Vacio deja la columna sin valor.',
        example: '+51 902 665 565',
      },
    },
  },
  CambioPasswordEntrada: {
    type: 'object',
    required: ['actual', 'nueva'],
    properties: {
      actual: { type: 'string', description: 'La contrasena con la que entra hoy' },
      nueva: {
        type: 'string',
        minLength: 12,
        description:
          'Minimo 12 caracteres. Se rechazan las comunes, las repeticiones, las secuencias y las que contienen su nombre o su correo.',
        example: 'brisa-tablero-19-norte',
      },
    },
  },
  LineaPedido: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['producto', 'curso'] },
      nombre: { type: 'string', example: 'Caja de carton reforzada 40x40' },
      cantidad: { type: 'integer', example: 2 },
      precio: { type: 'number', description: 'Precio cobrado por unidad', example: 19.9 },
      total: { type: 'number', example: 39.8 },
    },
  },
  Pedido: {
    type: 'object',
    properties: {
      uuid: { type: 'string', format: 'uuid' },
      codigo: {
        type: 'string',
        description: 'Codigo corto del pedido, el que ve el cliente',
        example: 'PED-0192F0',
      },
      estadoPago: {
        type: 'string',
        enum: ['pagado', 'pendiente'],
        description: 'Con tarjeta o Yape queda pagado; por WhatsApp queda pendiente de cobro',
      },
      metodoPago: { type: 'string', enum: ['tarjeta', 'yape', 'whatsapp'] },
      subtotal: { type: 'number', description: 'Suma de los precios de lista', example: 51.8 },
      descuento: { type: 'number', description: 'Lo que se ahorro por las ofertas', example: 12 },
      total: { type: 'number', example: 39.8 },
      createdAt: { type: 'string', format: 'date-time' },
      items: { type: 'array', items: ref('LineaPedido') },
    },
  },
  PedidoEntrada: {
    type: 'object',
    description:
      'Solo se envian las referencias y las cantidades: el precio, el descuento y el total los calcula el servidor con el catalogo.',
    required: ['metodoPago', 'items'],
    properties: {
      metodoPago: { type: 'string', enum: ['tarjeta', 'yape', 'whatsapp'] },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: {
          type: 'object',
          required: ['tipo', 'uuid', 'cantidad'],
          properties: {
            tipo: { type: 'string', enum: ['producto', 'curso'] },
            uuid: { type: 'string', format: 'uuid' },
            cantidad: {
              type: 'integer',
              minimum: 1,
              maximum: 99,
              description: 'En los cursos siempre 1: es una sola inscripcion',
            },
          },
        },
      },
    },
  },
  Publicacion: {
    type: 'object',
    properties: {
      uuid: {
        type: 'string',
        format: 'uuid',
        description: 'Identificador publico del articulo: lo usa el panel para editar y eliminar',
        example: '3f1d9d6a-2c47-4f0a-9d4b-6f0c3b8a1e22',
      },
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
      parameters: [
        ...PARAMETROS_LISTADO,
        { name: 'orden', in: 'query', schema: { type: 'string', enum: ['recientes', 'antiguos', 'nombre', 'precio-asc', 'precio-desc'], default: 'recientes' } },
        ...['precioMin', 'precioMax'].map((name) => ({ name, in: 'query', description: 'Precio de lista en soles; mínimo y máximo inclusivos.', schema: { type: 'number', minimum: 0, maximum: 999999.99 } })),
        ...(opciones.ruta === 'products'
          ? [{ name: 'stock', in: 'query', schema: { type: 'string', enum: ['disponible', 'agotado'] } }]
          : [{ name: 'duracionMax', in: 'query', description: 'Duración máxima del curso en minutos.', schema: { type: 'integer', minimum: 0, maximum: 100000 } }]),
      ],
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
  [`/catalog/${opciones.ruta}/{uuid}`]: {
    get: {
      tags: ['Catalogo'],
      summary: `Obtiene un ${opciones.entidad}`,
      parameters: [parametroUuid(opciones.entidad)],
      responses: {
        '200': sobre(
          { type: 'object', properties: { [opciones.claveUno]: ref(opciones.esquema) } },
          `${opciones.entidad} encontrado`
        ),
        '400': error('El identificador no es un uuid valido'),
        '404': error(`No existe el ${opciones.entidad}`),
      },
    },
    put: {
      tags: ['Catalogo'],
      summary: `Edita un ${opciones.entidad} (solo ADMIN)`,
      description: 'Reemplaza el registro completo con el cuerpo enviado.',
      security: [{ bearerAuth: [] }],
      parameters: [parametroUuid(opciones.entidad)],
      requestBody: cuerpoJson(`${opciones.esquema}Entrada`),
      responses: {
        '200': sobre(
          { type: 'object', properties: { [opciones.claveUno]: ref(opciones.esquema) } },
          `${opciones.entidad} actualizado`
        ),
        '400': error('El identificador no es un uuid valido'),
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
      parameters: [parametroUuid(opciones.entidad)],
      responses: {
        '204': { description: 'Eliminado. Sin cuerpo' },
        '400': error('El identificador no es un uuid valido'),
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
    { name: 'Pedidos', description: 'Compras del usuario que tiene la sesion abierta' },
    { name: 'Aprendizaje', description: 'Los cursos a los que el usuario tiene acceso' },
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
      put: {
        tags: ['Auth'],
        summary: 'Edita los datos del perfil',
        description:
          'Cambia nombre, apellido y telefono del usuario de la sesion. El correo no se edita aqui: cambiarlo sin verificar el buzon nuevo permitiria secuestrar la cuenta.',
        security: [{ bearerAuth: [] }],
        requestBody: cuerpoJson('PerfilEntrada'),
        responses: {
          '200': sobre({ type: 'object', properties: { usuario: ref('Usuario') } }, 'Perfil actualizado'),
          '401': error('Falta el token, no es valido o expiro'),
          '422': error('Datos invalidos: el mensaje indica el campo'),
        },
      },
    },
    '/auth/me/password': {
      put: {
        tags: ['Auth'],
        summary: 'Cambia la contrasena',
        description:
          'Pide la contrasena actual y aplica la misma politica que el registro. Al terminar cierra las demas sesiones del usuario; la sesion desde la que se cambia sigue abierta.',
        security: [{ bearerAuth: [] }],
        requestBody: cuerpoJson('CambioPasswordEntrada'),
        responses: {
          '204': { description: 'Contrasena cambiada. Sin cuerpo' },
          '401': error('La contrasena actual no es correcta, o falta el token'),
          '422': error('La contrasena nueva no cumple la politica'),
          '429': error('Demasiados intentos desde esta conexion'),
        },
      },
    },
    '/auth/me/avatar': {
      put: {
        tags: ['Auth'],
        summary: 'Guarda la foto de perfil ya subida a Cloudinary',
        description:
          'El navegador sube la imagen a Cloudinary con la firma y aqui solo envia su direccion. La foto anterior se borra.',
        security: [{ bearerAuth: [] }],
        requestBody: cuerpoJson('AvatarEntrada'),
        responses: {
          '200': sobre({ type: 'object', properties: { usuario: ref('Usuario') } }, 'Foto actualizada'),
          '401': error('Falta el token, no es valido o expiro'),
          '422': error('La direccion de la imagen no es valida'),
        },
      },
      post: {
        tags: ['Auth'],
        summary: 'Cambia la foto de perfil subiendo el archivo',
        description:
          'Acepta JPG, PNG, WEBP o GIF de hasta 5 MB, comprobados por la firma del archivo. La foto anterior se borra del disco.',
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
          '200': sobre({ type: 'object', properties: { usuario: ref('Usuario') } }, 'Foto actualizada'),
          '400': error('No se adjunto el archivo en el campo imagen'),
          '401': error('Falta el token, no es valido o expiro'),
          '413': error('La imagen supera 5 MB'),
          '415': error('El archivo no es una imagen permitida'),
        },
      },
      delete: {
        tags: ['Auth'],
        summary: 'Quita la foto de perfil',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': sobre({ type: 'object', properties: { usuario: ref('Usuario') } }, 'Perfil sin foto'),
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
        description: `Publico. ${POR_PAGINA_DEFECTO} por pagina por defecto. Por defecto salen las mas recientes primero; con orden=leidos salen las mas leidas (seccion "Lo mas leido").`,
        parameters: [
          ...PARAMETROS_LISTADO,
          {
            name: 'orden',
            in: 'query',
            description: 'Orden por fecha, número de lecturas o título. Un valor inválido vuelve a recientes.',
            schema: { type: 'string', enum: ['recientes', 'leidos', 'antiguos', 'titulo'], default: 'recientes' },
          },
          ...['desde', 'hasta'].map((name) => ({ name, in: 'query', description: 'Fecha inclusiva en el calendario de Perú (UTC-5). Los rangos inválidos devuelven 400.', schema: { type: 'string', format: 'date' } })),
        ],
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
    '/posts/{referencia}': {
      get: {
        tags: ['Publicaciones'],
        summary: 'Obtiene una publicacion por uuid o por slug',
        description:
          'Con el uuid devuelve el articulo tal cual (lo usa el panel). Con el slug de la URL publica suma una lectura al contador views, salvo que sea un borrador.',
        parameters: [
          {
            name: 'referencia',
            in: 'path',
            required: true,
            description: 'uuid del articulo o su slug publico',
            schema: { type: 'string', example: 'pausas-activas-en-la-oficina' },
          },
        ],
        responses: {
          '200': sobre({ type: 'object', properties: { publicacion: ref('Publicacion') } }, 'Publicacion encontrada'),
          '404': error('No existe la publicacion'),
        },
      },
      put: {
        tags: ['Publicaciones'],
        summary: 'Edita una publicacion (solo ADMIN)',
        description: 'Si se reemplaza la portada, la anterior subida al servidor se borra del disco.',
        security: [{ bearerAuth: [] }],
        parameters: [parametroUuid('articulo')],
        requestBody: cuerpoJson('PublicacionEntrada'),
        responses: {
          '200': sobre({ type: 'object', properties: { publicacion: ref('Publicacion') } }, 'Publicacion actualizada'),
          '400': error('El identificador no es un uuid valido'),
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
        parameters: [parametroUuid('articulo')],
        responses: {
          '204': { description: 'Eliminada. Sin cuerpo' },
          '400': error('El identificador no es un uuid valido'),
          ...ERRORES_ADMIN,
          '404': error('No existe la publicacion'),
        },
      },
    },
    '/orders': {
      post: {
        tags: ['Pedidos'],
        summary: 'Registra una compra',
        description:
          'Guarda el pedido a nombre del usuario de la sesion. El servidor vuelve a leer cada articulo del catalogo para calcular el precio, el descuento y el total, y rechaza el pedido si algo dejo de estar disponible o si se piden mas unidades de las que hay.',
        security: [{ bearerAuth: [] }],
        requestBody: cuerpoJson('PedidoEntrada'),
        responses: {
          '201': sobre({ type: 'object', properties: { pedido: ref('Pedido') } }, 'Pedido guardado'),
          '401': error('Falta el token o no es valido'),
          '409': error('Un articulo ya no esta disponible o no hay unidades suficientes'),
          '422': error('Datos invalidos: el mensaje indica el campo'),
        },
      },
    },
    '/orders/mios': {
      get: {
        tags: ['Pedidos'],
        summary: 'Lista las compras del usuario',
        description: 'Solo devuelve los pedidos del usuario de la sesion, del mas reciente al mas antiguo.',
        security: [{ bearerAuth: [] }],
        parameters: PARAMETROS_LISTADO.filter((parametro) => parametro.name !== 'estado'),
        responses: {
          '200': sobre(
            {
              type: 'object',
              properties: {
                pedidos: { type: 'array', items: ref('Pedido') },
                paginacion: ref('Paginacion'),
              },
            },
            'Compras del usuario'
          ),
          '401': error('Falta el token o no es valido'),
        },
      },
    },
    '/catalog/courses/{uuid}/lecciones': {
      get: {
        tags: ['Catalogo'],
        summary: 'Temario del curso',
        description:
          'Publico. Devuelve los titulos de todas las lecciones, pero el video solo de las que ese visitante puede ver: la marcada como muestra y, si envia su token, las del curso que compro. Lo bloqueado llega con videoUrl y youtubeId en null, asi el contenido no se filtra mirando la respuesta.',
        parameters: [parametroUuid('curso')],
        responses: {
          '200': sobre({ type: 'object', properties: { temario: ref('Temario') } }, 'Temario del curso'),
          '400': error('El identificador no es un uuid valido'),
          '404': error('No existe el curso'),
        },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Agrega una leccion al curso (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [parametroUuid('curso')],
        requestBody: cuerpoJson('LeccionEntrada'),
        responses: {
          '201': sobre({ type: 'object', properties: { leccion: ref('Leccion') } }, 'Leccion agregada'),
          ...ERRORES_ADMIN,
          '404': error('No existe el curso'),
          '422': error('Datos invalidos: el mensaje indica el campo'),
        },
      },
    },
    '/catalog/courses/{uuid}/lecciones/admin': {
      get: {
        tags: ['Catalogo'],
        summary: 'Temario completo para el panel (solo ADMIN)',
        description: 'Igual que el temario publico pero con el video de todas las lecciones.',
        security: [{ bearerAuth: [] }],
        parameters: [parametroUuid('curso')],
        responses: {
          '200': sobre({ type: 'object', properties: { temario: ref('Temario') } }, 'Temario completo'),
          ...ERRORES_ADMIN,
          '404': error('No existe el curso'),
        },
      },
    },
    '/catalog/courses/{uuid}/lecciones/orden': {
      put: {
        tags: ['Catalogo'],
        summary: 'Reordena las lecciones (solo ADMIN)',
        description: 'Se envian los uuid de las lecciones en el orden deseado.',
        security: [{ bearerAuth: [] }],
        parameters: [parametroUuid('curso')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orden'],
                properties: { orden: { type: 'array', items: { type: 'string', format: 'uuid' } } },
              },
            },
          },
        },
        responses: {
          '200': sobre({ type: 'object', properties: { temario: ref('Temario') } }, 'Temario ordenado'),
          ...ERRORES_ADMIN,
          '422': error('El orden enviado no es valido'),
        },
      },
    },
    '/catalog/courses/{uuid}/lecciones/{leccionUuid}': {
      put: {
        tags: ['Catalogo'],
        summary: 'Edita una leccion (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [parametroUuid('curso'), { ...parametroUuid('leccion'), name: 'leccionUuid' }],
        requestBody: cuerpoJson('LeccionEntrada'),
        responses: {
          '200': sobre({ type: 'object', properties: { leccion: ref('Leccion') } }, 'Leccion actualizada'),
          ...ERRORES_ADMIN,
          '404': error('No existe el curso o la leccion'),
          '422': error('Datos invalidos: el mensaje indica el campo'),
        },
      },
      delete: {
        tags: ['Catalogo'],
        summary: 'Elimina una leccion (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [parametroUuid('curso'), { ...parametroUuid('leccion'), name: 'leccionUuid' }],
        responses: {
          '204': { description: 'Eliminada. Sin cuerpo' },
          ...ERRORES_ADMIN,
          '404': error('No existe el curso o la leccion'),
        },
      },
    },
    '/lms/mis-cursos': {
      get: {
        tags: ['Aprendizaje'],
        summary: 'Lista los cursos comprados por el usuario',
        description:
          'Los cursos que aparecen en algun pedido del usuario de la sesion, sin repetirse y del mas reciente al mas antiguo.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': sobre(
            { type: 'object', properties: { cursos: { type: 'array', items: ref('CursoComprado') } } },
            'Cursos con acceso'
          ),
          '401': error('Falta el token, no es valido o expiro'),
        },
      },
    },
    '/uploads/firma/catalogo': {
      post: {
        tags: ['Archivos'],
        summary: 'Firma una subida a Cloudinary (solo ADMIN)',
        description:
          'Devuelve los datos con los que el navegador sube la imagen directo a Cloudinary, en la carpeta del catalogo. Responde 503 si el servidor no tiene Cloudinary configurado; en ese caso se usa POST /uploads/imagenes.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': sobre({ type: 'object', properties: { firma: ref('FirmaSubida') } }, 'Firma emitida'),
          ...ERRORES_ADMIN,
          '503': error('Cloudinary no esta configurado en el servidor'),
        },
      },
    },
    '/uploads/firma/avatar': {
      post: {
        tags: ['Archivos'],
        summary: 'Firma la subida de una foto de perfil',
        description:
          'Igual que la del catalogo pero en la carpeta de avatares. La puede pedir cualquier usuario con sesion.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': sobre({ type: 'object', properties: { firma: ref('FirmaSubida') } }, 'Firma emitida'),
          '401': error('Falta el token, no es valido o expiro'),
          '503': error('Cloudinary no esta configurado en el servidor'),
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
