/**
 * report.congreso_resultados
 * Relaciones:
 * - codigo_departamento -> divi_departamentos.codigo_departamento
 * - codigo_divipola -> divi_municipio (municipio; en BD el campo es codigo_divipole)
 */
export interface CongresoResultado {
  id: number;
  anio_eleccion: number;
  corporacion: string | null;
  circunscripcion: string | null;
  circ_rep: string | null;
  codigo_departamento: string;
  /** En BD: codigo_divipole. Relación con divi_municipio. */
  codigo_divipola: string;
  nombre_puesto: string | null;
  comuna: string | null;
  mesa: string | null;
  votos: number;
  partido: string | null;
  nombre_candidato: string | null;
  origen: string | null;
  fecha_carga: Date | string | null;
}
