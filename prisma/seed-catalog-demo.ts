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

  for (const { imageUrl, ...datos } of PRODUCTOS) {
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

  for (const datos of CURSOS) {
    const existente = await prisma.course.findFirst({ where: { name: datos.name } });
    if (existente) continue;
    await prisma.course.create({ data: { ...datos, ownerId: admin.userId } });
    cursosCreados++;
  }

  console.log(`Catálogo demo: ${productosCreados} productos y ${cursosCreados} cursos creados`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
