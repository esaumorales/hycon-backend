// Contrasenas que aparecen en las filtraciones mas conocidas y variantes locales.
// No es una lista exhaustiva: frena lo que un atacante probaria primero.
// Se comparan en minusculas y sin tildes.
export const CONTRASENAS_COMUNES = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345678910', '123123', '123321',
  '654321', '111111', '000000', '121212', '112233', '666666', '777777', '888888', '999999',
  '123456123456', '123456789012', '1234567890123', '0987654321', '147258369', '159753',
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwerty123456', 'asdfgh', 'asdfghjkl', 'zxcvbnm',
  '1q2w3e4r', '1q2w3e4r5t', '1qaz2wsx', 'qazwsx', 'abc123', 'abcd1234', 'abc12345',
  'iloveyou', 'iloveyou123', 'letmein', 'welcome', 'welcome1', 'welcome123', 'admin', 'admin123',
  'admin1234', 'administrator', 'root', 'toor', 'master', 'monkey', 'dragon', 'football',
  'baseball', 'superman', 'batman', 'sunshine', 'princess', 'shadow', 'michael', 'charlie',
  'trustno1', 'starwars', 'whatever', 'freedom', 'secret', 'changeme', 'default', 'guest',
  'test', 'test123', 'testing', 'demo', 'demo123', 'login', 'user', 'usuario', 'usuario123',
  'contrasena', 'contrasena1', 'contrasena123', 'micontrasena', 'clave', 'clave123', 'miclave',
  'secreto', 'teamo', 'teamo123', 'tequiero', 'amor', 'amor123', 'amormio', 'corazon',
  'princesa', 'princesa123', 'mariposa', 'estrella', 'futbol', 'futbol123', 'barcelona',
  'realmadrid', 'alianza', 'alianzalima', 'universitario', 'cristal', 'peru', 'peru123',
  'peru2024', 'peru2025', 'peru2026', 'lima', 'lima123', 'arequipa', 'arequipa123', 'mipassword',
  'bienvenido', 'bienvenido123', 'hola', 'hola123', 'hola1234', 'holamundo', 'qwertyui',
  'hycon', 'hycon123', 'hycon2024', 'hycon2025', 'hycon2026', 'hyconlat', 'ergonomia',
  'ergonomo', 'logistica', 'empresa', 'empresa123', 'oficina', 'trabajo', 'trabajo123',
  'aaaaaa', 'aaaaaaaa', 'abcdef', 'abcdefgh', 'abcdefghijkl', 'zaq12wsx', 'q1w2e3r4t5y6',
  'passwordpassword', 'contrasenacontrasena', '11111111', '00000000', '12341234', '87654321',
]);
