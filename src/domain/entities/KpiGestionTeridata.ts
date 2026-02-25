/**
 * report.kpis_gestion_teridata
 * Relación: codigo_departamento -> divi_departamentos.codigo_departamento
 */
export interface KpiGestionTeridata {
  codigo_divipole: string | null;
  codigo_departamento: string | null;
  dimension: string | null;
  subcategoria: string | null;
  indicador: string | null;
  unidad_medida: string | null;
  dato_numerico: number | null;
  dato_cualitativo: string | null;
  anio: number | null;
  mes: number | null;
  fuente: string | null;
}
