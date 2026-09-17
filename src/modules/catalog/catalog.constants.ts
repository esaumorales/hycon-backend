// Agencias de envio con las que se puede despachar un producto.
// En la base se guarda solo el codigo; el nombre visible sale de aqui.
export const AGENCIAS_ENVIO = [
  { code: 'shalom', name: 'Shalom' },
  { code: 'olva', name: 'Olva Courier' },
  { code: 'marvisur', name: 'Marvisur' },
  { code: 'cruz-del-sur', name: 'Cruz del Sur Cargo' },
  { code: 'civa', name: 'Civa Cargo' },
  { code: 'serpost', name: 'Serpost' },
] as const;

export type CodigoAgencia = (typeof AGENCIAS_ENVIO)[number]['code'];

export const CODIGOS_AGENCIA = AGENCIAS_ENVIO.map((agencia) => agencia.code) as [
  CodigoAgencia,
  ...CodigoAgencia[],
];

// Los codigos que ya no existen en la lista se descartan al leer, no rompen el listado
export const resolverAgencias = (codigos: string[]) =>
  AGENCIAS_ENVIO.filter((agencia) => codigos.includes(agencia.code)).map((agencia) => ({
    code: agencia.code,
    name: agencia.name,
  }));

// Paginacion de los listados del catalogo
export const POR_PAGINA_DEFECTO = 6;
export const POR_PAGINA_MAXIMO = 50;
