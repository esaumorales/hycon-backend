import { describe, expect, it } from 'vitest';
import { crearCursoSchema, crearProductoSchema } from './catalog.schema';

const productoBase = { name: 'Caja de carton', price: '25.90', stock: '10' };
const cursoBase = { name: 'Logistica basica', price: '120' };

describe('crearProductoSchema', () => {
  it('convierte precio y stock que llegan como texto del formulario', () => {
    const resultado = crearProductoSchema.parse(productoBase);
    expect(resultado.price).toBe(25.9);
    expect(resultado.stock).toBe(10);
  });

  it('pone estado active y stock cero por defecto', () => {
    const resultado = crearProductoSchema.parse({ name: 'Cinta', price: '5' });
    expect(resultado.status).toBe('active');
    expect(resultado.stock).toBe(0);
  });

  it('rechaza precios de cero o negativos', () => {
    expect(crearProductoSchema.safeParse({ ...productoBase, price: '0' }).success).toBe(false);
    expect(crearProductoSchema.safeParse({ ...productoBase, price: '-5' }).success).toBe(false);
  });

  it('rechaza stock negativo o con decimales', () => {
    expect(crearProductoSchema.safeParse({ ...productoBase, stock: '-1' }).success).toBe(false);
    expect(crearProductoSchema.safeParse({ ...productoBase, stock: '1.5' }).success).toBe(false);
  });

  it('exige que el descuento sea menor que el precio', () => {
    const igual = crearProductoSchema.safeParse({ ...productoBase, discountPrice: '25.90' });
    const mayor = crearProductoSchema.safeParse({ ...productoBase, discountPrice: '30' });
    const menor = crearProductoSchema.safeParse({ ...productoBase, discountPrice: '19.90' });

    expect(igual.success).toBe(false);
    expect(mayor.success).toBe(false);
    expect(menor.success).toBe(true);
  });

  it('trata los campos opcionales vacios como ausentes', () => {
    const resultado = crearProductoSchema.parse({
      ...productoBase,
      brand: '',
      model: '',
      description: '',
      imageUrl: '',
    });

    expect(resultado.brand).toBeUndefined();
    expect(resultado.imageUrl).toBeUndefined();
  });

  it('trata los numeros opcionales vacios como ausentes, no como cero', () => {
    // El formulario envia cadena vacia cuando el usuario no rellena el campo
    const resultado = crearProductoSchema.parse({
      ...productoBase,
      discountPrice: '',
      stock: '',
    });

    expect(resultado.discountPrice).toBeUndefined();
    expect(resultado.stock).toBe(0);
  });

  it('rechaza una URL de imagen mal formada', () => {
    expect(
      crearProductoSchema.safeParse({ ...productoBase, imageUrl: 'no-es-una-url' }).success
    ).toBe(false);
  });

  it('rechaza estados fuera de la lista permitida', () => {
    expect(crearProductoSchema.safeParse({ ...productoBase, status: 'borrado' }).success).toBe(
      false
    );
  });

  it('rechaza nombres de un solo caracter', () => {
    expect(crearProductoSchema.safeParse({ ...productoBase, name: 'A' }).success).toBe(false);
  });
});

describe('crearCursoSchema', () => {
  it('acepta un curso con lo minimo obligatorio', () => {
    const resultado = crearCursoSchema.parse(cursoBase);
    expect(resultado.price).toBe(120);
    expect(resultado.status).toBe('active');
  });

  it('convierte la duracion a entero', () => {
    const resultado = crearCursoSchema.parse({ ...cursoBase, durationMinutes: '90' });
    expect(resultado.durationMinutes).toBe(90);
  });

  it('rechaza duraciones de cero o negativas', () => {
    expect(crearCursoSchema.safeParse({ ...cursoBase, durationMinutes: '0' }).success).toBe(false);
    expect(crearCursoSchema.safeParse({ ...cursoBase, durationMinutes: '-10' }).success).toBe(
      false
    );
  });

  it('valida las URLs de video y miniatura', () => {
    expect(crearCursoSchema.safeParse({ ...cursoBase, videoUrl: 'youtube' }).success).toBe(false);
    expect(
      crearCursoSchema.safeParse({ ...cursoBase, videoUrl: 'https://youtu.be/abc' }).success
    ).toBe(true);
  });

  it('exige que el descuento sea menor que el precio', () => {
    expect(crearCursoSchema.safeParse({ ...cursoBase, discountPrice: '150' }).success).toBe(false);
  });

  it('acepta duracion y descuento vacios sin convertirlos en cero', () => {
    const resultado = crearCursoSchema.parse({
      ...cursoBase,
      durationMinutes: '',
      discountPrice: '',
      videoUrl: '',
      thumbnailUrl: '',
    });

    expect(resultado.durationMinutes).toBeUndefined();
    expect(resultado.discountPrice).toBeUndefined();
    expect(resultado.videoUrl).toBeUndefined();
  });
});
