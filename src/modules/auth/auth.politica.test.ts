import { describe, expect, it } from 'vitest';
import { evaluarPassword } from './auth.politica';

const persona = { email: 'ana.quispe@hycon.lat', name: 'Ana Lucia', lastname: 'Quispe' };

describe('evaluarPassword', () => {
  it('acepta una frase larga sin exigir simbolos ni mayusculas', () => {
    expect(evaluarPassword('cafe con leche en arequipa', persona)).toBeNull();
    expect(evaluarPassword('Montana-Roja-Misti-7', persona)).toBeNull();
  });

  it('exige al menos 12 caracteres', () => {
    expect(evaluarPassword('Corta1!', persona)).toMatch(/12 caracteres/);
    expect(evaluarPassword('123456', persona)).toMatch(/12 caracteres/);
  });

  it('limita el largo y los bytes que bcrypt puede usar', () => {
    expect(evaluarPassword('a'.repeat(129) + 'x', persona)).toMatch(/128/);
    // 40 emojis ocupan 160 bytes aunque sean pocos caracteres
    expect(evaluarPassword('\u{1F512}'.repeat(40))).toMatch(/demasiado larga/);
  });

  it('rechaza contrasenas comunes, tambien con numeros o signos al final', () => {
    for (const comun of ['password1234', 'contraseña2026!', 'Arequipa123456', 'qwertyuiop12', 'hycon2026!!!!']) {
      expect(evaluarPassword(comun, persona)).toMatch(/muy comun/);
    }
  });

  it('rechaza repeticiones y secuencias', () => {
    expect(evaluarPassword('aaaaaaaaaaaa')).toMatch(/muy comun/);
    expect(evaluarPassword('abababababab')).toMatch(/muy comun/);
    expect(evaluarPassword('123456789012')).toMatch(/muy comun/);
    expect(evaluarPassword('lkjihgfedcba')).toMatch(/muy comun/);
  });

  it('rechaza contrasenas que contienen el nombre, el apellido o el correo', () => {
    expect(evaluarPassword('QuispeFuerte2026', persona)).toMatch(/nombre ni tu correo/);
    expect(evaluarPassword('lucia-y-su-gato-99', persona)).toMatch(/nombre ni tu correo/);
    expect(evaluarPassword('ana.quispe.secreta', persona)).toMatch(/nombre ni tu correo/);
  });

  it('ignora fragmentos personales demasiado cortos para no dar falsos positivos', () => {
    // "Ana" tiene 3 letras: "banana" no debe rechazarse por eso
    expect(evaluarPassword('banana split con fresas', persona)).toBeNull();
  });
});
