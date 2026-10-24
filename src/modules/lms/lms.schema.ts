import { z } from 'zod';
import { buscarSchema, paginaSchema, porPaginaSchema } from '../../core/utils/filtros-listado';
import { POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO } from '../catalog/catalog.constants';

// Filtros de "mis cursos". Cada parametro invalido cae a su valor por defecto
// por separado, asi un ?pagina=abc no invalida tambien el orden.
export const misCursosQuerySchema = z.object({
  buscar: buscarSchema,
  orden: z.enum(['recientes', 'antiguos', 'nombre']).catch('recientes'),
  pagina: paginaSchema,
  porPagina: porPaginaSchema(POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO),
});

export type MisCursosQuery = z.infer<typeof misCursosQuerySchema>;
