// Evaluaciones ergonomicas que se cotizan, con su norma y su precio.
// El precio vive aqui: lo que llegue del navegador nunca se usa para cobrar.
export interface EvaluacionErgonomica {
  codigo: string;
  nombre: string;
  norma: string;
  precio: number;
}

export const EVALUACIONES: EvaluacionErgonomica[] = [
  {
    codigo: 'movimientos-repetitivos',
    nombre: 'Movimientos repetitivos de miembros superiores',
    norma: 'ISO 11228-3:2026',
    precio: 250,
  },
  {
    codigo: 'levantamiento-cargas',
    nombre: 'Levantamiento de cargas',
    norma: 'ISO 11228-1:2021',
    precio: 200,
  },
  {
    codigo: 'empuje-traccion',
    nombre: 'Empuje y tracción',
    norma: 'ISO 11228-2:2007',
    precio: 250,
  },
  {
    codigo: 'posturas-forzadas',
    nombre: 'Posturas forzadas',
    norma: 'ISO 11226:2000',
    precio: 200,
  },
];

export const CODIGOS_EVALUACION = EVALUACIONES.map((evaluacion) => evaluacion.codigo);

export const buscarEvaluacion = (codigo: string): EvaluacionErgonomica | undefined =>
  EVALUACIONES.find((evaluacion) => evaluacion.codigo === codigo);
