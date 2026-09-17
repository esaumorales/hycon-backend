import sanitizeHtml from 'sanitize-html';

// Solo el formato que ofrece el editor del panel. Todo lo demas (scripts, estilos,
// iframes, atributos on*) se elimina aunque alguien llame a la API directamente.
export const ETIQUETAS_PERMITIDAS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'hr',
];

const ENLACE_SEGURO = /^(https?:\/\/|mailto:)/i;

const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: ETIQUETAS_PERMITIDAS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: (etiqueta, atributos) =>
      ENLACE_SEGURO.test(atributos.href ?? '')
        ? {
            // Los enlaces abren en otra pestana sin dar acceso a la pagina original
            tagName: etiqueta,
            attribs: { ...atributos, target: '_blank', rel: 'noopener noreferrer nofollow' },
          }
        : // Un enlace peligroso o vacio pierde la etiqueta pero conserva su texto
          { tagName: 'span', attribs: {} },
    // Titulos de nivel 1 en el contenido competirian con el titulo del articulo
    h1: 'h2',
  },
};

const escaparHtml = (texto: string) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pareceHtml = (texto: string) => /<\/?[a-z][\s\S]*>/i.test(texto);

/**
 * Deja el contenido listo para guardar: HTML limpio con el formato permitido.
 * Si llega texto plano (por ejemplo desde un cliente de la API), cada bloque
 * separado por una linea en blanco se convierte en un parrafo.
 */
export const sanitizarContenido = (contenido: string): string => {
  const recortado = contenido.trim();
  if (!recortado) return '';

  if (!pareceHtml(recortado)) {
    return recortado
      .split(/\n\s*\n/)
      .map((parrafo) => parrafo.trim())
      .filter(Boolean)
      .map((parrafo) => `<p>${escaparHtml(parrafo).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  return sanitizeHtml(recortado, OPCIONES)
    // El editor deja parrafos vacios al principio o al final (por ejemplo tras pulsar Enter)
    .replace(/^(\s*<p>\s*(<br\s*\/?>)?\s*<\/p>)+/, '')
    .replace(/(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)+$/, '')
    .trim();
};

const ENTIDADES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

// Texto sin etiquetas, para contar palabras y validar que el articulo no este vacio
export const textoPlano = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entidad) => ENTIDADES[entidad])
    .replace(/\s+/g, ' ')
    .trim();
