import { textoPlano } from './posts.contenido';

// Palabras por minuto de un lector medio en espanol
const PALABRAS_POR_MINUTO = 200;
const MAXIMO_SLUG = 200;

/**
 * "Ergonomía en la oficina: 5 claves" -> "ergonomia-en-la-oficina-5-claves".
 * Sin tildes ni signos, para que la URL publica sea estable y legible.
 */
export const generarSlug = (titulo: string): string => {
  const slug = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAXIMO_SLUG)
    .replace(/-+$/g, '');

  return slug || 'articulo';
};

// Si el slug ya existe se numera: articulo, articulo-2, articulo-3...
export const slugDisponible = (base: string, ocupados: string[]): string => {
  const usados = new Set(ocupados);
  if (!usados.has(base)) return base;

  let numero = 2;
  while (usados.has(`${base}-${numero}`)) numero += 1;
  return `${base}-${numero}`;
};

// Acepta HTML: solo cuenta el texto visible
export const contarPalabras = (contenido: string): number => {
  const texto = textoPlano(contenido);
  return texto ? texto.split(' ').length : 0;
};

export const minutosDeLectura = (texto: string): number =>
  Math.max(1, Math.ceil(contarPalabras(texto) / PALABRAS_POR_MINUTO));
