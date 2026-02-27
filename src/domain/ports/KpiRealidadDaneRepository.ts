export interface DaneIndicatorRow {
  codigo_departamento: string;
  variable: string;
  anio: number | null;
  total: number;
  cabeceras: number | null;
  centros_poblados_rural: number | null;
}

export interface DaneIndicatorsResult {
  variables: string[];
  rows: DaneIndicatorRow[];
}

export interface KpiRealidadDaneRepository {
  findIndicatorsByDepartments(
    codigoDepartamentos: string[],
    year?: number
  ): Promise<DaneIndicatorsResult>;
  findYears(): Promise<number[]>;
}
