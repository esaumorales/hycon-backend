import { prisma } from '../src/core/database/prisma';

// Imagenes ilustrativas de Unsplash. Cada URL fue comprobada antes de sembrar.
const imagen = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80&ixlib=rb-4.1.0`;

const PRODUCTOS = [
  {
    name: 'Silla ergonómica de malla',
    description:
      'Producto de demostración para el catálogo Hycon. Silla de oficina con respaldo de malla, apoyabrazos y cabecera, pensada para un espacio de trabajo cómodo. Imagen ilustrativa; medidas, materiales y condiciones de entrega por confirmar.',
    brand: 'Hycon Demo',
    model: 'ERG-M01',
    price: 549,
    discountPrice: 479,
    stock: 8,
    status: 'active',
    imageUrl: imagen('1688578735352-9a6f2ac3b70a'),
  },
  {
    name: 'Escritorio de altura ajustable',
    description:
      'Producto de demostración para el catálogo Hycon. Escritorio para alternar el trabajo sentado y de pie y organizar el equipo de oficina. Imagen ilustrativa; rango de altura, dimensiones y acabados por confirmar.',
    brand: 'Hycon Demo',
    model: 'ERG-D02',
    price: 899,
    discountPrice: 799,
    stock: 6,
    status: 'active',
    imageUrl: imagen('1632923945531-7416f29116ca'),
  },
  {
    name: 'Soporte ajustable para laptop',
    description:
      'Producto de demostración para el catálogo Hycon. Base para elevar la pantalla de una laptop y liberar espacio en el escritorio. Imagen ilustrativa; compatibilidad, material y medidas por confirmar.',
    brand: 'Hycon Demo',
    model: 'ERG-L03',
    price: 119,
    discountPrice: 99,
    stock: 15,
    status: 'active',
    imageUrl: imagen('1671464884932-842296b12314'),
  },
  {
    name: 'Caja de cartón para envíos',
    description:
      'Producto de demostración para el catálogo Hycon. Caja de cartón corrugado para preparar pedidos y organizar despachos de ecommerce. Imagen ilustrativa; tamaño, resistencia y formato de venta por confirmar.',
    brand: 'Hycon Demo',
    model: 'LOG-C04',
    price: 12.9,
    discountPrice: 10.9,
    stock: 80,
    status: 'active',
    imageUrl: imagen('1624137527136-66e631bdaa0e'),
  },
] as const;

const CURSOS = [
  {
    name: 'Gestión de almacenes e inventarios',
    description:
      'Curso de muestra para visualizar el catálogo. Temario propuesto: recepción, ubicación, conteos cíclicos, control de existencias y preparación de pedidos. Duración y precio referenciales; contenido final por confirmar.',
    videoUrl: null,
    thumbnailUrl: imagen('1553413077-190dd305871c'),
    durationMinutes: 180,
    price: 149,
    discountPrice: 119,
    status: 'active',
  },
  {
    name: 'Operación de última milla',
    description:
      'Curso de muestra para visualizar el catálogo. Temario propuesto: planificación de rutas, asignación de entregas, seguimiento de pedidos e incidencias en reparto. Duración y precio referenciales; contenido final por confirmar.',
    videoUrl: null,
    thumbnailUrl: imagen('1620455800201-7f00aeef12ed'),
    durationMinutes: 150,
    price: 139,
    discountPrice: 109,
    status: 'active',
  },
  {
    name: 'Ergonomía en el puesto de trabajo',
    description:
      'Curso de muestra para visualizar el catálogo. Temario propuesto: organización del escritorio, postura, pausas activas y ajustes básicos del espacio de trabajo. Duración y precio referenciales; contenido final por confirmar.',
    videoUrl: null,
    thumbnailUrl: imagen('1632923945657-ccd98efe59e3'),
    durationMinutes: 120,
    price: 119,
    discountPrice: 89,
    status: 'active',
  },
  {
    name: 'Atención al cliente para ecommerce',
    description:
      'Curso de muestra para visualizar el catálogo. Temario propuesto: comunicación con compradores, seguimiento de consultas, manejo de reclamos y respuestas claras después de la venta. Duración y precio referenciales; contenido final por confirmar.',
    videoUrl: null,
    thumbnailUrl: imagen('1709715357479-591f9971fb05'),
    durationMinutes: 135,
    price: 129,
    discountPrice: 99,
    status: 'active',
  },
] as const;


// More varied demo records for checking card density and multiple pages.
// Existing records are kept; a repeated run skips names/slugs already present.
const PRODUCTOS_ADICIONALES = [
  'Cinta de embalaje transparente', 'Dispensador de cinta de embalaje',
  'Film stretch para paletizado', 'Sobres acolchados para ecommerce',
  'Etiquetas adhesivas para despacho', 'Bolsas de seguridad para envíos',
  'Separadores de cartón corrugado', 'Papel kraft para protección',
  'Rollo de plástico burbuja', 'Caja organizadora de almacén',
  'Balanza digital de paquetería', 'Lector de códigos de barras',
  'Impresora térmica de etiquetas', 'Carro de carga plegable',
  'Estante modular para inventario', 'Contenedor apilable de picking',
  'Guantes de trabajo para almacén', 'Chaleco reflectante de reparto',
  'Mochila de reparto térmica', 'Portapapeles para despacho',
  'Reposapiés ajustable de oficina', 'Soporte de monitor regulable',
  'Mouse ergonómico vertical', 'Teclado compacto de oficina',
  'Lámpara de escritorio articulada', 'Cojín lumbar para oficina',
  'Organizador de cables de escritorio', 'Alfombrilla con apoyo de muñeca',
  'Mesa auxiliar de trabajo', 'Soporte doble para monitores',
].map((name, i) => ({
  name,
  description: `Registro de demostración para evaluar el diseño y la paginación. ${name} para equipar espacios de trabajo o preparar despachos. Fotografía ilustrativa, precio y disponibilidad de prueba.`,
  brand: 'Hycon Demo', model: `DEMO-${String(i + 1).padStart(3, '0')}`,
  price: 29 + i * 17, discountPrice: i % 4 === 0 ? 24 + i * 14 : null,
  stock: i % 11 === 0 ? 0 : 12 + i * 3, status: 'active',
  imageUrl: PRODUCTOS[i % PRODUCTOS.length].imageUrl,
}));

const CURSOS_ADICIONALES = [
  'Planificación de rutas de reparto', 'Control de inventarios con hojas de cálculo',
  'Preparación de pedidos y picking', 'Recepción y clasificación de mercadería',
  'Embalaje seguro para ecommerce', 'Indicadores de una operación logística',
  'Gestión de devoluciones y cambios', 'Comunicación con clientes en reparto',
  'Introducción a la logística urbana', 'Organización de almacenes pequeños',
  'Trazabilidad de pedidos y entregas', 'Costos de distribución y transporte',
  'Fotografía de productos para catálogos', 'Introducción al comercio electrónico',
  'Redacción de fichas de productos', 'Servicio posventa para tiendas online',
  'Organización del puesto de oficina', 'Pausas activas para equipos de trabajo',
  'Uso responsable de equipos de carga', 'Planificación de turnos operativos',
  'Digitalización de procesos de almacén', 'Gestión documental de despachos',
  'Herramientas para supervisores de reparto', 'Mejora continua en operaciones',
].map((name, i) => ({
  name,
  description: `Curso de demostración para comprobar las vistas del catálogo. ${name}: introducción, ejemplos prácticos y una actividad de repaso. Contenido, duración y precio de muestra; no representa una inscripción real.`,
  videoUrl: null, thumbnailUrl: CURSOS[i % CURSOS.length].thumbnailUrl,
  durationMinutes: 60 + (i % 6) * 30,
  price: 79 + (i % 8) * 20, discountPrice: i % 3 === 0 ? 59 + (i % 8) * 15 : null,
  status: 'active',
}));

const PUBLICACIONES = [
  ['Cómo organizar una zona de preparación de pedidos', 'Distribuye materiales, productos y etiquetas en estaciones claras para preparar tus pedidos.'],
  ['Una lista de revisión para despachar sin olvidos', 'Revisa dirección, cantidades, empaque y documentación antes de entregar un pedido al reparto.'],
  ['Qué revisar al elegir una caja de envío', 'Compara tamaño, protección y espacio libre al preparar un paquete para ecommerce.'],
  ['Inventarios: cómo empezar con conteos cíclicos', 'Una propuesta de organización para revisar pequeñas partes del inventario durante la semana.'],
  ['Cómo registrar incidencias de entrega', 'Reúne la información necesaria para dar seguimiento a retrasos, direcciones y reprogramaciones.'],
  ['Un escritorio ordenado para trabajar mejor', 'Ideas de distribución y organización para mantener materiales y equipos al alcance.'],
  ['Cómo redactar una ficha de producto clara', 'Presenta características, medidas y condiciones de manera consistente en tu catálogo.'],
  ['Cinco indicadores para revisar tus despachos', 'Organiza datos de entregas, tiempos y consultas para entender tu operación diaria.'],
  ['Primeros pasos para una tienda online', 'Una guía de muestra sobre catálogo, preparación de pedidos y atención al comprador.'],
  ['Cómo preparar una devolución organizada', 'Define los pasos de recepción, revisión y comunicación para los productos que regresan.'],
  ['La importancia de etiquetar el almacén', 'Una identificación consistente facilita ubicar productos y revisar sus existencias.'],
  ['Planifica tu semana de entregas', 'Agrupa tareas y horarios para dar seguimiento a los pedidos previstos durante la semana.'],
  ['Materiales básicos para una estación de embalaje', 'Una lista inicial de insumos para preparar paquetes y mantener ordenada la mesa de trabajo.'],
  ['Cómo comunicar el estado de un pedido', 'Usa mensajes claros para explicar preparación, despacho y confirmación de entrega.'],
  ['Organización de documentos de despacho', 'Mantén referencias, comprobantes y notas vinculados con cada pedido de tu operación.'],
  ['Cómo elegir imágenes para tu catálogo', 'Presenta fotografías consistentes que permitan reconocer cada producto con facilidad.'],
  ['Preparación de pedidos durante campañas', 'Una propuesta para ordenar la carga de trabajo cuando aumenta el volumen de pedidos.'],
  ['Una rutina de cierre para el almacén', 'Revisa pedidos pendientes, materiales e incidencias antes de terminar la jornada.'],
].map(([title, excerpt], i) => ({
  title, excerpt,
  slug: `demo-${title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`,
  content: `<p><strong>Artículo de demostración.</strong> Este contenido permite revisar el diseño, la lectura y el listado de publicaciones de Hycon.</p><h2>${title}</h2><p>${excerpt}</p><h3>Antes de empezar</h3><p>Identifica las tareas de tu equipo, prepara una lista de materiales y acuerda cómo registrar los avances. Adapta los ejemplos a tu espacio y a la cantidad de pedidos que manejas.</p><h3>Una propuesta de trabajo</h3><ul><li>Define quién se encarga de cada etapa.</li><li>Registra las observaciones en un lugar compartido.</li><li>Revisa el resultado al terminar la jornada.</li></ul><p>Los ejemplos de esta publicación son datos de muestra para comprobar la presentación del sitio.</p>`,
  coverUrl: CURSOS[i % CURSOS.length].thumbnailUrl,
  status: 'active', views: (i + 1) * 13,
  publishedAt: new Date(Date.now() - i * 86400000),
}));
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Los datos de demostración no se cargan en producción');
  }

  const admin = await prisma.user.findFirst({
    where: { role: { name: 'ADMIN' } },
    select: { userId: true },
  });
  if (!admin) throw new Error('No hay un usuario ADMIN. Ejecuta primero npm run seed');

  let productosCreados = 0;
  let cursosCreados = 0;

  for (const { imageUrl, ...datos } of [...PRODUCTOS, ...PRODUCTOS_ADICIONALES]) {
    const existente = await prisma.product.findFirst({ where: { name: datos.name } });
    if (existente) continue;
    await prisma.product.create({
      data: {
        ...datos,
        ownerId: admin.userId,
        images: { create: [{ imageUrl, isThumbnail: true, sortOrder: 0 }] },
      },
    });
    productosCreados++;
  }

  for (const datos of [...CURSOS, ...CURSOS_ADICIONALES]) {
    const existente = await prisma.course.findFirst({ where: { name: datos.name } });
    if (existente) continue;
    await prisma.course.create({ data: { ...datos, ownerId: admin.userId } });
    cursosCreados++;
  }

  let publicacionesCreadas = 0;
  for (const datos of PUBLICACIONES) {
    if (await prisma.post.findUnique({ where: { slug: datos.slug } })) continue;
    await prisma.post.create({ data: { ...datos, authorId: admin.userId } });
    publicacionesCreadas++;
  }
  console.log(`Publicaciones demo: ${publicacionesCreadas} creadas`);
  const [productos, cursos, publicaciones] = await Promise.all([
    prisma.product.count({where:{status:'active'}}),
    prisma.course.count({where:{status:'active'}}),
    prisma.post.count({where:{status:'active'}}),
  ]);
  console.log(`Totales activos: ${productos} productos, ${cursos} cursos, ${publicaciones} publicaciones`);
  console.log(`Catálogo demo: ${productosCreados} productos y ${cursosCreados} cursos creados`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
