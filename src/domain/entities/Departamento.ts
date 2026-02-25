/**
 * report.divi_departamentos
 * Relación: codigo_departamento con codigo_departamento (divi_municipio, kpis_*, congreso_resultados).
 * congreso_resultados relaciona municipio por codigo_divipole, no por codigo_municipio.
 */
export interface Departamento {
  codigo_departamento: string;
  nombre: string;
}
