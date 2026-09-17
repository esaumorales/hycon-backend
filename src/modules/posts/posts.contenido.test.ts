import { describe, expect, it } from 'vitest';
import { sanitizarContenido, textoPlano } from './posts.contenido';

describe('sanitizarContenido', () => {
  it('conserva el formato del editor', () => {
    const html =
      '<h2>Claves</h2><p>Texto con <strong>negrita</strong>, <em>cursiva</em>, <u>subrayado</u> y <s>tachado</s>.</p>' +
      '<ul><li><p>Uno</p></li></ul><ol><li><p>Dos</p></li></ol><blockquote><p>Cita</p></blockquote><hr>';

    const limpio = sanitizarContenido(html);

    for (const etiqueta of ['<h2>', '<strong>', '<em>', '<u>', '<s>', '<ul>', '<ol>', '<li>', '<blockquote>', '<hr />']) {
      expect(limpio).toContain(etiqueta);
    }
  });

  it('elimina scripts, estilos, iframes y eventos', () => {
    const limpio = sanitizarContenido(
      '<p onclick="robar()" style="color:red">Hola</p><script>alert(1)</script><iframe src="https://x.com"></iframe><img src=x onerror=alert(1)>'
    );

    expect(limpio).toBe('<p>Hola</p>');
  });

  it('solo deja enlaces http, https o mailto y los abre de forma segura', () => {
    const limpio = sanitizarContenido(
      '<p><a href="https://hycon.lat" onmouseover="x()">sitio</a> <a href="javascript:alert(1)">malo</a></p>'
    );

    expect(limpio).toContain(
      '<a href="https://hycon.lat" target="_blank" rel="noopener noreferrer nofollow">sitio</a>'
    );
    expect(limpio).not.toContain('javascript');
    expect(limpio).toContain('malo');
  });

  it('convierte un h1 en h2 para no competir con el titulo del articulo', () => {
    expect(sanitizarContenido('<h1>Grande</h1>')).toBe('<h2>Grande</h2>');
  });

  it('convierte texto plano en parrafos escapando lo que parezca HTML suelto', () => {
    expect(sanitizarContenido('Primero\nsigue\n\nSegundo & ultimo')).toBe(
      '<p>Primero<br>sigue</p><p>Segundo &amp; ultimo</p>'
    );
  });

  it('recorta los parrafos vacios del principio y del final', () => {
    expect(sanitizarContenido('<p></p><h2>Hola</h2><p>Texto</p><p></p><p><br></p>')).toBe(
      '<h2>Hola</h2><p>Texto</p>'
    );
    // Los vacios intermedios los decide quien escribe
    expect(sanitizarContenido('<p>Uno</p><p></p><p>Dos</p>')).toBe('<p>Uno</p><p></p><p>Dos</p>');
  });

  it('un contenido vacio queda vacio', () => {
    expect(sanitizarContenido('   ')).toBe('');
  });
});

describe('textoPlano', () => {
  it('quita etiquetas, decodifica entidades y une espacios', () => {
    expect(textoPlano('<h2>Hola</h2><p>uno&nbsp;&amp;&nbsp;dos</p><ul><li><p>tres</p></li></ul>')).toBe(
      'Hola uno & dos tres'
    );
  });

  it('un parrafo vacio del editor no tiene texto', () => {
    expect(textoPlano('<p></p>')).toBe('');
  });
});
