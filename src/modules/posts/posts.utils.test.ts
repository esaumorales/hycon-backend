import { describe, expect, it } from 'vitest';
import { contarPalabras, generarSlug, minutosDeLectura, slugDisponible } from './posts.utils';

describe('generarSlug', () => {
  it('quita tildes, signos y mayusculas', () => {
    expect(generarSlug('Ergonomía en la oficina: 5 claves')).toBe('ergonomia-en-la-oficina-5-claves');
    expect(generarSlug('¿Cómo levantar cargas sin lesionarse?')).toBe(
      'como-levantar-cargas-sin-lesionarse'
    );
    expect(generarSlug('Diseño y año')).toBe('diseno-y-ano');
  });

  it('no deja guiones repetidos ni en los extremos', () => {
    expect(generarSlug('  --Hola   mundo!!--  ')).toBe('hola-mundo');
  });

  it('usa un valor por defecto si el titulo no tiene letras', () => {
    expect(generarSlug('¿?¡!')).toBe('articulo');
  });

  it('limita el largo sin terminar en guion', () => {
    const slug = generarSlug(`${'palabra '.repeat(60)}`);
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('slugDisponible', () => {
  it('usa el slug tal cual si esta libre', () => {
    expect(slugDisponible('pausas-activas', ['otro'])).toBe('pausas-activas');
  });

  it('numera a partir de 2 saltando los ocupados', () => {
    expect(slugDisponible('pausas-activas', ['pausas-activas'])).toBe('pausas-activas-2');
    expect(slugDisponible('pausas-activas', ['pausas-activas', 'pausas-activas-2'])).toBe(
      'pausas-activas-3'
    );
  });
});

describe('lectura', () => {
  it('cuenta palabras ignorando espacios y saltos de linea', () => {
    expect(contarPalabras('  uno  dos\n\ntres ')).toBe(3);
    expect(contarPalabras('   ')).toBe(0);
  });

  it('no cuenta las etiquetas HTML como palabras', () => {
    expect(contarPalabras('<h2>Titulo</h2><p><strong>uno</strong> dos</p>')).toBe(3);
  });

  it('calcula minutos a 200 palabras por minuto, minimo uno', () => {
    expect(minutosDeLectura('corto')).toBe(1);
    expect(minutosDeLectura('palabra '.repeat(201))).toBe(2);
    expect(minutosDeLectura('palabra '.repeat(1000))).toBe(5);
  });
});
