import type { Pool } from 'pg';
import type {
  KpiGestionTeridataRepository,
  TeradataIndicatorsResult,
} from '../../domain/ports/KpiGestionTeridataRepository';

/**
 * report.kpis_gestion_teridata
 * Relación: codigo_departamento -> divi_departamentos.codigo_departamento
 */
export class PostgresKpiGestionTeridataRepository implements KpiGestionTeridataRepository {
  constructor(
    private readonly pool: Pool,
    private readonly schema: string = 'report'
  ) {}

  private get table(): string {
    return `"${this.schema}".kpis_gestion_teridata`;
  }

  async findIndicatorsByDepartments(
    codigoDepartamentos: string[],
    year?: number
  ): Promise<TeradataIndicatorsResult> {
    if (codigoDepartamentos.length === 0) {
      return { indicators: [], rows: [] };
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
      WITH filtrado AS (
        SELECT codigo_departamento, indicador,
               MAX(COALESCE(TRIM(dimension), 'Otros')) AS dimension,
               AVG(dato_numerico)::double precision AS valor
        FROM ${this.table}
        WHERE (TRIM(LEADING '0' FROM COALESCE(codigo_departamento::text, '')) IN (${placeholders})
               OR codigo_departamento::text IN (${placeholders}))
          AND indicador IS NOT NULL AND TRIM(COALESCE(indicador, '')) <> ''
          ${yearFilter}
        GROUP BY codigo_departamento, indicador
      )
      SELECT codigo_departamento::text AS codigo_departamento, indicador, dimension, COALESCE(valor, 0) AS valor
      FROM filtrado
    `;
    const result = await this.pool.query(query, params);
    const rows = (result.rows as { codigo_departamento: string; indicador: string; dimension: string | null; valor: string }[]).map(
      (r) => ({
        codigo_departamento: String(r.codigo_departamento ?? ''),
        indicador: String(r.indicador ?? ''),
        valor: Number(r.valor) || 0,
        dimension: r.dimension != null && String(r.dimension).trim() !== '' ? String(r.dimension).trim() : null,
      })
    );
    const indicatorSet = new Set<string>();
    rows.forEach((r) => indicatorSet.add(r.indicador));
    const indicators = Array.from(indicatorSet).sort();
    return { indicators, rows };
  }
}
