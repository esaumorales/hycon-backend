import { describe, expect, it } from 'vitest';
import { esVideoValido, interpretarVideo, referenciaDe } from './referencias';

describe('interpretarVideo', () => {
  it('reconoce un enlace de YouTube', () => {
    expect(interpretarVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      proveedor: 'youtube',
      clave: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('reconoce un archivo de R2', () => {
    expect(interpretarVideo('r2:cursos/01a0/parte-1.mp4')).toEqual({
      proveedor: 'r2',
      clave: 'cursos/01a0/parte-1.mp4',
    });
  });

  it('reconoce un video de Cloudflare Stream', () => {
    const uid = 'ea95132c15732412d22c1476fa83f27a';
    expect(interpretarVideo(`stream:${uid}`)).toEqual({ proveedor: 'stream', clave: uid });
  });

  it('descarta lo vacio y lo que no se puede reproducir', () => {
    expect(interpretarVideo(null)).toBeNull();
    expect(interpretarVideo('   ')).toBeNull();
    expect(interpretarVideo('https://vimeo.com/12345')).toBeNull();
  });

  // La clave acaba dentro de una URL firmada: un salto de carpeta llegaria a otro bucket
  it('rechaza claves con saltos de carpeta o caracteres raros', () => {
    expect(interpretarVideo('r2:../otro-bucket/privado.mp4')).toBeNull();
    expect(interpretarVideo('r2:cursos/../../secreto.mp4')).toBeNull();
    expect(interpretarVideo('r2:cursos//doble.mp4')).toBeNull();
    expect(interpretarVideo('r2:cursos/parte 1.mp4')).toBeNull();
    expect(interpretarVideo('r2:cursos/parte?firma=1.mp4')).toBeNull();
  });

  it('rechaza un uid de Stream que no tiene forma de uid', () => {
    expect(interpretarVideo('stream:corto')).toBeNull();
    expect(interpretarVideo('stream:con-guiones-que-no-valen-aqui')).toBeNull();
  });
});

describe('referenciaDe', () => {
  it('pone el prefijo de cada almacen y deja el enlace de YouTube tal cual', () => {
    expect(referenciaDe('r2', 'cursos/a/b.mp4')).toBe('r2:cursos/a/b.mp4');
    expect(referenciaDe('stream', 'ea95132c15732412d22c1476fa83f27a')).toBe(
      'stream:ea95132c15732412d22c1476fa83f27a'
    );
    expect(referenciaDe('youtube', 'https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://youtu.be/dQw4w9WgXcQ'
    );
  });

  it('lo que se guarda se vuelve a leer igual', () => {
    const referencia = referenciaDe('r2', 'cursos/01a0/parte-1.mp4');
    expect(interpretarVideo(referencia)).toEqual({
      proveedor: 'r2',
      clave: 'cursos/01a0/parte-1.mp4',
    });
  });
});

describe('esVideoValido', () => {
  it('acepta lo que el formulario puede guardar', () => {
    expect(esVideoValido('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(esVideoValido('r2:cursos/01a0/parte-1.mp4')).toBe(true);
    expect(esVideoValido('texto cualquiera')).toBe(false);
  });
});
