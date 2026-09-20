import { CONTRASENAS_COMUNES } from './auth.contrasenas-comunes';

// Politica basada en NIST SP 800-63B y OWASP ASVS 2.1: longitud antes que reglas de
// composicion ("una mayuscula, un simbolo..."), y rechazo de contrasenas previsibles.
export const LARGO_MINIMO_PASSWORD = 12;
export const LARGO_MAXIMO_PASSWORD = 128;
// bcrypt solo usa los primeros 72 bytes: mas alla, dos contrasenas distintas valdrian igual
export const BYTES_MAXIMOS_PASSWORD = 72;

export interface DatosPersonales {
  email?: string;
  name?: string;
  lastname?: string;
}

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// "aaaaaaaaaaaa", "121212121212": un unico bloque repetido
const esRepeticion = (texto: string) => /^(.{1,3})\1+$/.test(texto);

// "123456789012", "abcdefghijkl" y sus versiones al reves
const esSecuencia = (texto: string) => {
  if (texto.length < 4) return false;
  const pasos = new Set<number>();
  for (let i = 1; i < texto.length; i += 1) {
    pasos.add(texto.charCodeAt(i) - texto.charCodeAt(i - 1));
  }
  return pasos.size === 1 && [1, -1].includes([...pasos][0]);
};

// Partes del nombre y del correo con suficiente longitud para ser reconocibles
const fragmentosPersonales = ({ email, name, lastname }: DatosPersonales): string[] => {
  const local = email ? email.split('@')[0] : '';
  return [local, ...local.split(/[._\-+]/), name ?? '', ...(name ?? '').split(/\s+/), lastname ?? '', ...(lastname ?? '').split(/\s+/)]
    .map(normalizar)
    .filter((fragmento) => fragmento.length >= 4);
};

/**
 * Devuelve el motivo por el que la contrasena no es aceptable, o null si lo es.
 * Solo se aplica al crear o cambiar una contrasena, nunca al iniciar sesion.
 */
export const evaluarPassword = (password: string, datos: DatosPersonales = {}): string | null => {
  if (password.length < LARGO_MINIMO_PASSWORD) {
    return `La contrasena debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`;
  }
  if (password.length > LARGO_MAXIMO_PASSWORD) {
    return `La contrasena no puede superar los ${LARGO_MAXIMO_PASSWORD} caracteres`;
  }
  if (Buffer.byteLength(password, 'utf8') > BYTES_MAXIMOS_PASSWORD) {
    return 'La contrasena es demasiado larga para guardarse de forma segura';
  }

  const limpia = normalizar(password);
  // Tambien se detecta la comun con numeros o signos al final: "contrasena2026!"
  const sinFinal = limpia.replace(/[\d\W_]+$/, '');
  if (
    CONTRASENAS_COMUNES.has(limpia) ||
    (sinFinal.length >= 4 && CONTRASENAS_COMUNES.has(sinFinal)) ||
    esRepeticion(limpia) ||
    esSecuencia(limpia)
  ) {
    return 'Esta contrasena es muy comun o facil de adivinar. Elige otra';
  }

  const compacta = limpia.replace(/[\s._-]/g, '');
  if (fragmentosPersonales(datos).some((fragmento) => compacta.includes(fragmento.replace(/[\s._-]/g, '')))) {
    return 'La contrasena no debe contener tu nombre ni tu correo';
  }

  return null;
};
