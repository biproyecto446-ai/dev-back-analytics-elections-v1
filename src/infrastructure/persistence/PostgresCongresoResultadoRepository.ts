import type { Pool } from 'pg';
import type { CongresoResultado } from '../../domain/entities/CongresoResultado';
import type {
  CongresoResultadoRepository,
  CongresoSummaryRow,
  CongresoTrendRow,
  TopPartidoRow,
  MunicipioOption,
  ElectionSummaryRow,
} from '../../domain/ports/CongresoResultadoRepository';

const MAX_LIMIT = 2000;
const COUNT_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * report.congreso_resultados
 * Relaciones: codigo_departamento -> divi_departamentos.codigo_departamento
 *             codigo_divipola (en BD: codigo_divipole) -> divi_municipio. No existe codigo_municipio.
 */
export class PostgresCongresoResultadoRepository implements CongresoResultadoRepository {
  private countCache: { value: number; expiresAt: number } | null = null;

  constructor(
    private readonly pool: Pool,
    private readonly schema: string = 'report'
  ) {}

  private get table(): string {
    return `"${this.schema}".congreso_resultados`;
  }

  async findPaginated(page: number, limit: number): Promise<CongresoResultado[]> {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
    const offset = (safePage - 1) * safeLimit;
    const result = await this.pool.query(
      `SELECT id, anio_eleccion, corporacion, circunscripcion, circ_rep, codigo_departamento, codigo_divipole AS codigo_divipola,
              nombre_puesto, comuna, mesa, votos, partido, nombre_candidato, origen, fecha_carga
       FROM ${this.table}
       ORDER BY anio_eleccion DESC, codigo_departamento, votos DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, offset]
    );
    return result.rows.map(this.mapRow);
  }

  async getCount(): Promise<number> {
    const now = Date.now();
    if (this.countCache && this.countCache.expiresAt > now) return this.countCache.value;
    const result = await this.pool.query(`SELECT COUNT(*)::bigint AS total FROM ${this.table}`);
    const total = Number(result.rows[0]?.total ?? 0);
    this.countCache = { value: total, expiresAt: now + COUNT_CACHE_TTL_MS };
    return total;
  }

  async findSummaryByYearAndDepartments(
    year: number,
    codigoDepartamentos: string[]
  ): Promise<CongresoSummaryRow[]> {
    if (codigoDepartamentos.length === 0) return [];
    // Normalizar códigos (quitar ceros a la izquierda) para que "011" y "11" coincidan
    const normalized = codigoDepartamentos.map((c) => String(c).trim().replace(/^0+/, '') || '0');
    const placeholders = normalized.map((_, i) => `$${i + 2}`).join(',');
    const query = `
      WITH agg AS (
        SELECT codigo_departamento, partido, SUM(votos)::bigint AS votes
        FROM ${this.table}
        WHERE anio_eleccion = $1
          AND (TRIM(LEADING '0' FROM COALESCE(codigo_departamento::text, '')) IN (${placeholders})
               OR codigo_departamento::text IN (${placeholders}))
          AND partido IS NOT NULL AND TRIM(COALESCE(partido, '')) <> ''
        GROUP BY codigo_departamento, partido
      ),
      ranked AS (
        SELECT codigo_departamento, partido, votes,
               ROW_NUMBER() OVER (PARTITION BY codigo_departamento ORDER BY votes DESC) AS rn
        FROM agg
      )
      SELECT codigo_departamento, partido, votes::int AS votes, rn FROM ranked
    `;
    const result = await this.pool.query(query, [year, ...normalized]);
    return result.rows.map((r: { codigo_departamento: string | number; partido: string; votes: number; rn: number }) => ({
      codigo_departamento: String(r.codigo_departamento ?? ''),
      partido: r.partido,
      votes: r.votes,
      rn: r.rn,
    }));
  }

  async findTrendByDepartments(
    codigoDepartamentos: string[]
  ): Promise<{ years: number[]; rows: CongresoTrendRow[] }> {
    if (codigoDepartamentos.length === 0) return { years: [], rows: [] };
    const yearsResult = await this.pool.query(
      `SELECT DISTINCT anio_eleccion AS y FROM ${this.table} WHERE anio_eleccion IS NOT NULL ORDER BY anio_eleccion`
    );
    const years = (yearsResult.rows as { y: number }[]).map((r) => r.y);
    if (years.length === 0) return { years: [], rows: [] };
    const placeholders = codigoDepartamentos.map((_, i) => `$${i + 2}`).join(',');
    const query = `
      SELECT anio_eleccion, codigo_departamento, partido, SUM(votos)::bigint AS votes
      FROM ${this.table}
      WHERE anio_eleccion = ANY($1::int[]) AND codigo_departamento IN (${placeholders}) AND partido IS NOT NULL
      GROUP BY anio_eleccion, codigo_departamento, partido
    `;
    const result = await this.pool.query(query, [years, ...codigoDepartamentos]);
    const rows: CongresoTrendRow[] = result.rows.map(
      (r: { anio_eleccion: number; codigo_departamento: string; partido: string; votes: string }) => ({
        anio_eleccion: r.anio_eleccion,
        codigo_departamento: r.codigo_departamento,
        partido: r.partido,
        votes: Number(r.votes),
      })
    );
    return { years, rows };
  }

  async findYears(): Promise<number[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT anio_eleccion AS year FROM ${this.table} WHERE anio_eleccion IS NOT NULL ORDER BY anio_eleccion`
    );
    return (result.rows as { year: number }[]).map((r) => r.year);
  }

  /** Normaliza código para comparación: trim y quita ceros a la izquierda (evita desajustes entre front y BD). */
  private normalizeCode(value: string | number): string {
    const s = String(value).trim();
    return s.replace(/^0+/, '') || '0';
  }

  private buildScopeConditions(filters: {
    year?: number;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
  }): { conditions: string[]; params: (number | string)[] } {
    const conditions: string[] = ['partido IS NOT NULL', "TRIM(COALESCE(partido, '')) <> ''"];
    const params: (number | string)[] = [];
    let paramIndex = 1;
    if (filters.year != null && !Number.isNaN(filters.year)) {
      conditions.push(`anio_eleccion = $${paramIndex}`);
      params.push(filters.year);
      paramIndex++;
    }
    if (filters.codigoDepartamento != null && String(filters.codigoDepartamento).trim() !== '') {
      const raw = String(filters.codigoDepartamento).trim();
      const norm = this.normalizeCode(raw);
      const col = 'TRIM(COALESCE(codigo_departamento::text, \'\'))';
      conditions.push(`(TRIM(LEADING '0' FROM ${col}) = $${paramIndex} OR ${col} = $${paramIndex + 1})`);
      params.push(norm, raw);
      paramIndex += 2;
    }
    if (filters.codigoMunicipio != null && String(filters.codigoMunicipio).trim() !== '') {
      const raw = String(filters.codigoMunicipio).trim();
      const norm = this.normalizeCode(raw);
      const col = 'TRIM(COALESCE(codigo_divipole::text, \'\'))';
      conditions.push(`(TRIM(LEADING '0' FROM ${col}) = $${paramIndex} OR ${col} = $${paramIndex + 1})`);
      params.push(norm, raw);
      paramIndex += 2;
    }
    return { conditions, params };
  }

  async findTopPartidosByVotos(filters: {
    year?: number;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
    excludeParty?: string;
  }): Promise<TopPartidoRow[]> {
    const { conditions, params } = this.buildScopeConditions(filters);
    let paramIndex = params.length + 1;
    if (filters.excludeParty != null && String(filters.excludeParty).trim() !== '') {
      conditions.push(`TRIM(COALESCE(partido, '')) <> $${paramIndex}`);
      params.push(String(filters.excludeParty).trim());
      paramIndex++;
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      WITH agg AS (
        SELECT partido, SUM(votos)::bigint AS total_votos
        FROM ${this.table}
        ${whereClause}
        GROUP BY partido
      ),
      ranked AS (
        SELECT partido, total_votos, ROW_NUMBER() OVER (ORDER BY total_votos DESC) AS rn
        FROM agg
      )
      SELECT partido, total_votos::int AS total_votos, rn::int AS rn
      FROM ranked
      ORDER BY rn
      LIMIT 7
    `;
    const result = await this.pool.query(query, params);
    return (result.rows as { partido: string; total_votos: number; rn: number }[]).map((r) => ({
      partido: r.partido,
      totalVotos: r.total_votos,
      rank: r.rn,
    }));
  }

  async findTotalVotosByPartido(filters: {
    year?: number;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
    partido: string;
  }): Promise<number> {
    const { conditions, params } = this.buildScopeConditions(filters);
    const paramIndex = params.length + 1;
    conditions.push(`TRIM(COALESCE(partido, '')) = $${paramIndex}`);
    params.push(String(filters.partido).trim());
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const query = `
      SELECT COALESCE(SUM(votos)::bigint, 0) AS total
      FROM ${this.table}
      ${whereClause}
    `;
    const result = await this.pool.query(query, params);
    return Number(result.rows[0]?.total ?? 0);
  }

  async findTotalVotosByScope(filters: {
    year?: number;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
  }): Promise<number> {
    const { conditions, params } = this.buildScopeConditions(filters);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT COALESCE(SUM(votos)::bigint, 0) AS total
      FROM ${this.table}
      ${whereClause}
    `;
    const result = await this.pool.query(query, params);
    return Number(result.rows[0]?.total ?? 0);
  }

  async findPartidosByScope(filters: {
    year?: number;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
  }): Promise<{ partido: string }[]> {
    const { conditions, params } = this.buildScopeConditions(filters);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT DISTINCT TRIM(partido) AS partido
      FROM ${this.table}
      ${whereClause}
      ORDER BY partido
    `;
    const result = await this.pool.query(query, params);
    return (result.rows as { partido: string }[]).map((r) => ({ partido: String(r.partido ?? '').trim() })).filter((r) => r.partido !== '');
  }

  /**
   * Municipios del departamento usando la relación divi_departamentos → divi_municipio por codigo_departamento.
   * Lista todos los municipios que pertenecen al departamento según divi_municipio.
   */
  async findMunicipiosByDepartment(
    codigoDepartamento: string,
    _year?: number
  ): Promise<MunicipioOption[]> {
    const normDept = String(codigoDepartamento).trim().replace(/^0+/, '') || '0';
    const municipioTable = `"${this.schema}".divi_municipio`;
    const query = `
      SELECT m.codigo_divipole AS codigo_divipola,
             m.des_municipio AS nombre
      FROM ${municipioTable} m
      WHERE (TRIM(LEADING '0' FROM COALESCE(m.codigo_departamento::text, '')) = $1 OR m.codigo_departamento::text = $2)
        AND m.codigo_divipole IS NOT NULL AND TRIM(COALESCE(m.codigo_divipole::text, '')) <> ''
      ORDER BY m.des_municipio, m.codigo_divipole
    `;
    const result = await this.pool.query(query, [normDept, normDept]);
    return (result.rows as { codigo_divipola: string; nombre: string | null }[]).map((r) => ({
      codigo_divipola: String(r.codigo_divipola ?? ''),
      nombre: r.nombre != null ? String(r.nombre).trim() : undefined,
    }));
  }

  async findElectionsSummary(): Promise<ElectionSummaryRow[]> {
    const query = `
      WITH by_year_party AS (
        SELECT anio_eleccion AS year, partido, SUM(votos)::bigint AS total
        FROM ${this.table}
        WHERE anio_eleccion IS NOT NULL AND partido IS NOT NULL AND TRIM(COALESCE(partido, '')) <> ''
        GROUP BY anio_eleccion, partido
      ),
      by_year AS (
        SELECT year, SUM(total)::bigint AS total_votos
        FROM by_year_party
        GROUP BY year
      ),
      ranked AS (
        SELECT year, partido, total, ROW_NUMBER() OVER (PARTITION BY year ORDER BY total DESC) AS rn
        FROM by_year_party
      )
      SELECT r.year::int AS year, t.total_votos::int AS total_votos, r.partido AS partido_ganador, r.total::int AS votos_ganador
      FROM ranked r
      JOIN by_year t ON t.year = r.year
      WHERE r.rn = 1
      ORDER BY r.year DESC
    `;
    const result = await this.pool.query(query);
    return (result.rows as { year: number; total_votos: number; partido_ganador: string; votos_ganador: number }[]).map((r) => ({
      year: r.year,
      totalVotos: r.total_votos,
      partidoGanador: r.partido_ganador || '—',
      votosPartidoGanador: r.votos_ganador ?? 0,
    }));
  }

  private mapRow(r: Record<string, unknown>): CongresoResultado {
    return {
      id: Number(r.id),
      anio_eleccion: Number(r.anio_eleccion),
      corporacion: r.corporacion as string | null,
      circunscripcion: r.circunscripcion as string | null,
      circ_rep: r.circ_rep as string | null,
      codigo_departamento: String(r.codigo_departamento ?? ''),
      codigo_divipola: String(r.codigo_divipola ?? ''),
      nombre_puesto: r.nombre_puesto as string | null,
      comuna: r.comuna as string | null,
      mesa: r.mesa as string | null,
      votos: Number(r.votos),
      partido: r.partido as string | null,
      nombre_candidato: r.nombre_candidato as string | null,
      origen: r.origen as string | null,
      fecha_carga: r.fecha_carga as Date | string | null,
    };
  }
}
