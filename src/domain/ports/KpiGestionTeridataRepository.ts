export interface TeradataIndicatorRow {
  codigo_departamento: string;
  indicador: string;
  valor: number;
  dimension: string | null;
}

export interface TeradataIndicatorsResult {
  indicators: string[];
  rows: TeradataIndicatorRow[];
}

export interface KpiGestionTeridataRepository {
  findIndicatorsByDepartments(
    codigoDepartamentos: string[],
    year?: number
  ): Promise<TeradataIndicatorsResult>;
  findYears(): Promise<number[]>;
}
