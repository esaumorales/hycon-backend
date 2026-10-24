/**
 * Crea un curso de prueba con sus partes en video, subidas a R2.
 * Uso: pnpm exec tsx prisma/seed-curso-video.ts [carpeta-con-los-mp4]
 */
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { env, r2Completo } from '../src/core/config/env';
import { prisma } from '../src/core/database/prisma';
import { crearAlmacenR2 } from '../src/modules/media/r2.service';
import { referenciaDe } from '../src/modules/media/referencias';

const PARTES = [
  {
    archivo: 'parte-1.mp4',
    titulo: 'Qué es la ergonomía y por qué importa',
    descripcion: 'La primera parte se ve gratis durante los segundos configurados en el curso.',
    muestra: true,
  },
  {
    archivo: 'parte-2.mp4',
    titulo: 'Evaluación del puesto de trabajo',
    descripcion: 'Cómo mirar una estación de trabajo y qué medir.',
    muestra: false,
  },
  {
    archivo: 'parte-3.mp4',
    titulo: 'Medidas correctivas',
    descripcion: 'Qué cambiar primero y con qué criterio.',
    muestra: false,
  },
  {
    archivo: 'parte-4.mp4',
    titulo: 'Seguimiento y cierre',
    descripcion: 'Cómo comprobar que la corrección funcionó.',
    muestra: false,
  },
];

const main = async () => {
  const carpeta = process.argv[2] ?? path.resolve(__dirname, 'videos-prueba');
  if (!r2Completo()) throw new Error('Faltan las claves de R2 en el .env');

  const admin = await prisma.user.findFirst({
    where: { role: { name: 'ADMIN' } },
    select: { userId: true, email: true },
  });
  if (!admin) throw new Error('No hay ningun usuario ADMIN en la base');

  const curso = await prisma.course.create({
    data: {
      ownerId: admin.userId,
      name: 'Curso de prueba con video propio',
      description:
        'Curso de prueba para comprobar el almacen de videos.\n\nCada parte muestra el segundo en el que va, para ver dónde corta la muestra gratuita.',
      durationMinutes: 1,
      // El minimo que acepta el formulario del panel son 5 segundos
      previewSeconds: 5,
      price: 49,
      status: 'active',
    },
    select: { courseId: true, uuid: true },
  });

  const r2 = crearAlmacenR2(env.R2);

  for (const [indice, parte] of PARTES.entries()) {
    const contenido = await readFile(path.resolve(carpeta, parte.archivo));
    const clave = r2.claveNueva(curso.uuid, randomUUID(), 'mp4');

    const subida = await fetch(r2.urlDeSubida(clave, 600), {
      method: 'PUT',
      body: new Uint8Array(contenido),
      headers: { 'Content-Type': 'video/mp4' },
    });
    if (!subida.ok) throw new Error(`No se pudo subir ${parte.archivo}: ${subida.status}`);

    await prisma.lesson.create({
      data: {
        courseId: curso.courseId,
        title: parte.titulo,
        description: parte.descripcion,
        videoUrl: referenciaDe('r2', clave),
        durationMinutes: 1,
        position: indice + 1,
        isPreview: parte.muestra,
      },
    });

    console.log(`subida ${parte.archivo} (${(contenido.length / 1024).toFixed(0)} KB)`);
  }

  console.log(`\ncurso creado: ${curso.uuid}`);
  console.log(`ficha:  /cursos/${curso.uuid}`);
  console.log(`aula:   /cursos/${curso.uuid}/aula`);
  console.log(`dueño:  ${admin.email}`);
};

main()
  .catch((error) => {
    console.error('fallo:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
