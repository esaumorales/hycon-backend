import { describe, expect, it } from 'vitest';
import { cursoSchema, listadoQuerySchema, productoSchema } from './catalog.schema';

const productoBase = { name: 'Caja de carton', price: '25.90', stock: '10' };
const cursoBase = { name: 'Logistica basica', price: '120' };

describe('productoSchema', () => {
  it('convierte precio y cantidad que llegan como texto del formulario', () => {
    const resultado = productoSchema.parse(productoBase);
    expect(resultado.price).toBe(25.9);
    expect(resultado.stock).toBe(10);
  });

  it('pone estado active, cantidad cero y ninguna agencia por defecto', () => {
    const resultado = productoSchema.parse({ name: 'Cinta', price: '5' });
    expect(resultado.status).toBe('active');
    expect(resultado.stock).toBe(0);
    expect(resultado.shippingAgencies).toEqual([]);
  });

  it('rechaza precios de cero o negativos', () => {
    expect(productoSchema.safeParse({ ...productoBase, price: '0' }).success).toBe(false);
    expect(productoSchema.safeParse({ ...productoBase, price: '-5' }).success).toBe(false);
  });

  it('rechaza cantidad negativa o con decimales', () => {
    expect(productoSchema.safeParse({ ...productoBase, stock: '-1' }).success).toBe(false);
    expect(productoSchema.safeParse({ ...productoBase, stock: '1.5' }).success).toBe(false);
  });

  it('exige que el descuento sea menor que el precio', () => {
    const igual = productoSchema.safeParse({ ...productoBase, discountPrice: '25.90' });
    const mayor = productoSchema.safeParse({ ...productoBase, discountPrice: '30' });
    const menor = productoSchema.safeParse({ ...productoBase, discountPrice: '19.90' });

    expect(igual.success).toBe(false);
    expect(mayor.success).toBe(false);
    expect(menor.success).toBe(true);
  });

  it('trata los campos opcionales vacios como ausentes', () => {
    const resultado = productoSchema.parse({
      ...productoBase,
      brand: '',
      model: '',
      color: '   ',
      description: '',
      imageUrl: '',
    });

    expect(resultado.brand).toBeUndefined();
    expect(resultado.color).toBeUndefined();
    expect(resultado.imageUrl).toBeUndefined();
  });

  it('trata los numeros opcionales vacios como ausentes, no como cero', () => {
    const resultado = productoSchema.parse({ ...productoBase, discountPrice: '', stock: '' });

    expect(resultado.discountPrice).toBeUndefined();
    expect(resultado.stock).toBe(0);
  });

  it('guarda el color recortado y limita su largo', () => {
    expect(productoSchema.parse({ ...productoBase, color: '  Azul marino ' }).color).toBe(
      'Azul marino'
    );
    expect(productoSchema.safeParse({ ...productoBase, color: 'x'.repeat(51) }).success).toBe(
      false
    );
  });

  it('acepta agencias conocidas y elimina las repetidas', () => {
    const resultado = productoSchema.parse({
      ...productoBase,
      shippingAgencies: ['shalom', 'olva', 'shalom'],
    });
    expect(resultado.shippingAgencies).toEqual(['shalom', 'olva']);
  });

  it('rechaza una agencia que no esta en la lista', () => {
    const resultado = productoSchema.safeParse({
      ...productoBase,
      shippingAgencies: ['shalom', 'dhl-inventada'],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza agencias que no llegan como lista', () => {
    expect(productoSchema.safeParse({ ...productoBase, shippingAgencies: 'shalom' }).success).toBe(
      false
    );
  });

  it('rechaza una URL de imagen mal formada', () => {
    expect(productoSchema.safeParse({ ...productoBase, imageUrl: 'no-es-una-url' }).success).toBe(
      false
    );
  });

  it('rechaza estados fuera de la lista permitida', () => {
    expect(productoSchema.safeParse({ ...productoBase, status: 'borrado' }).success).toBe(false);
  });

  it('rechaza nombres de un solo caracter', () => {
    expect(productoSchema.safeParse({ ...productoBase, name: 'A' }).success).toBe(false);
  });
});

describe('cursoSchema', () => {
  it('acepta un curso con lo minimo obligatorio', () => {
    const resultado = cursoSchema.parse(cursoBase);
    expect(resultado.price).toBe(120);
    expect(resultado.status).toBe('active');
  });

  it('convierte la duracion a entero', () => {
    expect(cursoSchema.parse({ ...cursoBase, durationMinutes: '90' }).durationMinutes).toBe(90);
  });

  it('rechaza duraciones de cero o negativas', () => {
    expect(cursoSchema.safeParse({ ...cursoBase, durationMinutes: '0' }).success).toBe(false);
    expect(cursoSchema.safeParse({ ...cursoBase, durationMinutes: '-10' }).success).toBe(false);
  });

  it('valida las URLs de video y miniatura', () => {
    expect(cursoSchema.safeParse({ ...cursoBase, videoUrl: 'youtube' }).success).toBe(false);
    expect(cursoSchema.safeParse({ ...cursoBase, videoUrl: 'https://youtu.be/abc' }).success).toBe(
      true
    );
  });

  it('exige que el descuento sea menor que el precio', () => {
    expect(cursoSchema.safeParse({ ...cursoBase, discountPrice: '150' }).success).toBe(false);
  });

  it('acepta duracion y descuento vacios sin convertirlos en cero', () => {
    const resultado = cursoSchema.parse({
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

describe('listadoQuerySchema', () => {
  it('por defecto pide la primera pagina de 6 activos', () => {
    expect(listadoQuerySchema.parse({})).toEqual({ estado: 'active', pagina: 1, porPagina: 6 });
  });

  it('convierte pagina y porPagina que llegan como texto en la URL', () => {
    expect(listadoQuerySchema.parse({ estado: 'todos', pagina: '3', porPagina: '12' })).toEqual({
      estado: 'todos',
      pagina: 3,
      porPagina: 12,
    });
  });

  it('cada valor invalido cae a su defecto sin arrastrar a los demas', () => {
    expect(listadoQuerySchema.parse({ estado: 'todos', pagina: 'abc', porPagina: '0' })).toEqual({
      estado: 'todos',
      pagina: 1,
      porPagina: 6,
    });
  });

  it('no deja pedir mas de 50 filas por pagina', () => {
    expect(listadoQuerySchema.parse({ porPagina: '5000' }).porPagina).toBe(6);
  });

  it('rechaza paginas negativas o decimales', () => {
    expect(listadoQuerySchema.parse({ pagina: '-2' }).pagina).toBe(1);
    expect(listadoQuerySchema.parse({ pagina: '1.5' }).pagina).toBe(1);
  });
});
