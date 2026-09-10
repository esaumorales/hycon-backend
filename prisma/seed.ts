import bcrypt from 'bcryptjs';
import { prisma } from '../src/core/database/prisma';

// Roles base del sistema. ADMIN es el unico que ve el panel de configuracion.
const ROLES = [
  { name: 'ADMIN', description: 'Administrador con acceso al panel de configuracion' },
  { name: 'CLIENTE', description: 'Usuario que compra productos y cursos' },
  { name: 'INSTRUCTOR', description: 'Usuario que publica y gestiona cursos' },
];

const USUARIOS_DEMO = [
  {
    name: 'Esau',
    lastname: 'Morales',
    email: process.env.ADMIN_EMAIL || 'info@hycon.lat',
    password: process.env.ADMIN_PASSWORD || '123456',
    rol: 'ADMIN',
  },
  {
    name: 'Ana',
    lastname: 'Quispe',
    email: 'cliente@hycon.com',
    password: 'Cliente2026',
    rol: 'CLIENTE',
  },
];

async function main() {
  // Los roles no tienen restriccion unica en el schema, asi que se comprueba a mano
  for (const rol of ROLES) {
    const existentes = await prisma.role.findMany({ where: { name: rol.name }, take: 1 });
    if (existentes.length === 0) {
      await prisma.role.create({ data: rol });
      console.log(`rol creado: ${rol.name}`);
    } else {
      console.log(`rol existente: ${rol.name}`);
    }
  }

  for (const demo of USUARIOS_DEMO) {
    const roles = await prisma.role.findMany({ where: { name: demo.rol }, take: 1 });
    const rol = roles[0];
    if (!rol) throw new Error(`No se encontro el rol ${demo.rol}`);

    const passwordHash = await bcrypt.hash(demo.password, 10);

    await prisma.user.upsert({
      where: { email: demo.email },
      update: { roleId: rol.roleId, passwordHash },
      create: {
        name: demo.name,
        lastname: demo.lastname,
        email: demo.email,
        passwordHash,
        roleId: rol.roleId,
      },
    });

    console.log(`usuario listo: ${demo.email} (${demo.rol})`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
