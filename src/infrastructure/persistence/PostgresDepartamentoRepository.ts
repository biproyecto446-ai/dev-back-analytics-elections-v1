import type { Pool } from 'pg';
import type { Departamento } from '../../domain/entities/Departamento';
import type { DepartamentoRepository } from '../../domain/ports/DepartamentoRepository';

/**
 * report.divi_departamentos
 * Relación: codigo_departamento -> codigo_departamento (en congreso_resultados, divi_municipio, kpis_*)
 */
export class PostgresDepartamentoRepository implements DepartamentoRepository {
  constructor(
    private readonly pool: Pool,
    private readonly schema: string = 'report'
  ) {}

  private get table(): string {
    return `"${this.schema}".divi_departamentos`;
  }

  async findAll(): Promise<Departamento[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT ON (codigo_departamento) codigo_departamento, nombre FROM ${this.table} ORDER BY codigo_departamento, nombre`
    );
    return result.rows.map((r: { codigo_departamento: string; nombre: string }) => ({
      codigo_departamento: r.codigo_departamento,
      nombre: r.nombre,
    }));
  }
}
