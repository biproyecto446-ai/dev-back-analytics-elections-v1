import type { Pool } from 'pg';
import type {
  DaneIndicatorRow,
  DaneIndicatorsResult,
  KpiRealidadDaneRepository,
} from '../../domain/ports/KpiRealidadDaneRepository';

/**
 * report.kpis_realidad_dane
 * Campos: variable, codigo_departamento, anio, total, cabeceras, centros_poblados_rural
 */
export class PostgresKpiRealidadDaneRepository implements KpiRealidadDaneRepository {
  constructor(
    private readonly pool: Pool,
    private readonly schema: string = 'report'
  ) {}

  private get table(): string {
    return `"${this.schema}".kpis_realidad_dane`;
  }

  async findIndicatorsByDepartments(
    codigoDepartamentos: string[],
    year?: number
  ): Promise<DaneIndicatorsResult> {
    if (codigoDepartamentos.length === 0) {
      return { variables: [], rows: [] };
    }
    const normalized = codigoDepartamentos.map((c) => String(c).trim().replace(/^0+/, '') || '0');
    const placeholders = normalized.map((_, i) => `$${i + 1}`).join(',');
    const params: (string | number)[] = [...normalized];
    let yearFilter = '';
    if (year != null && !Number.isNaN(year)) {
      params.push(year);
      yearFilter = `AND anio = $${params.length}`;
    }
    const query = `
      SELECT
        codigo_departamento::text AS codigo_departamento,
        COALESCE(TRIM(variable), '') AS variable,
        anio,
        COALESCE(total::double precision, 0) AS total,
        cabeceras::double precision AS cabeceras,
        centros_poblados_rural::double precision AS centros_poblados_rural
      FROM ${this.table}
      WHERE (TRIM(LEADING '0' FROM COALESCE(codigo_departamento::text, '')) IN (${placeholders})
             OR codigo_departamento::text IN (${placeholders}))
        AND variable IS NOT NULL AND TRIM(COALESCE(variable, '')) <> ''
        ${yearFilter}
      ORDER BY variable, codigo_departamento
    `;
    const result = await this.pool.query(query, params);
    const rows: DaneIndicatorRow[] = (result.rows as Record<string, unknown>[]).map((r) => ({
      codigo_departamento: String(r.codigo_departamento ?? ''),
      variable: String(r.variable ?? ''),
      anio: r.anio != null ? Number(r.anio) : null,
      total: Number(r.total) || 0,
      cabeceras: r.cabeceras != null ? Number(r.cabeceras) : null,
      centros_poblados_rural: r.centros_poblados_rural != null ? Number(r.centros_poblados_rural) : null,
    }));
    const variableSet = new Set<string>();
    rows.forEach((r) => variableSet.add(r.variable));
    const variables = Array.from(variableSet).sort();
    return { variables, rows };
  }

  async findYears(): Promise<number[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT anio FROM ${this.table} WHERE anio IS NOT NULL ORDER BY anio`
    );
    return (result.rows as { anio: number }[]).map((r) => Number(r.anio)).filter((y) => !Number.isNaN(y));
  }
}
