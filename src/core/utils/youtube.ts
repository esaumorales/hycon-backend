// Un id de YouTube siempre tiene 11 caracteres de este alfabeto
const PATRON_ID = /^[A-Za-z0-9_-]{11}$/;

const DOMINIOS_YOUTUBE = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

// Prefijos de ruta que llevan el id justo despues: /embed/ID, /shorts/ID...
const RUTAS_CON_ID = ['embed', 'shorts', 'live', 'v'];

/**
 * Devuelve el id del video a partir de cualquier link habitual de YouTube:
 * watch?v=, youtu.be/, shorts/, embed/, live/. Cualquier otra cosa devuelve null.
 */
export const extraerIdYoutube = (enlace: string | null | undefined): string | null => {
  if (!enlace) return null;

  let url: URL;
  try {
    url = new URL(enlace.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  const segmentos = url.pathname.split('/').filter(Boolean);
  let candidato: string | null = null;

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    candidato = segmentos[0] ?? null;
  } else if (DOMINIOS_YOUTUBE.has(host)) {
    if (segmentos[0] === 'watch') {
      candidato = url.searchParams.get('v');
    } else if (RUTAS_CON_ID.includes(segmentos[0])) {
      candidato = segmentos[1] ?? null;
    }
  }

  return candidato && PATRON_ID.test(candidato) ? candidato : null;
};

export const esEnlaceYoutube = (enlace: string) => extraerIdYoutube(enlace) !== null;
