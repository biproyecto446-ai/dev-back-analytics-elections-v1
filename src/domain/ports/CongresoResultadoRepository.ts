import type { CongresoResultado } from '../entities/CongresoResultado';

export interface CongresoResultadoPage {
  data: CongresoResultado[];
  page: number;
  limit: number;
}

export interface CongresoSummaryRow {
  codigo_departamento: string;
  partido: string;
  votes: number;
  rn: number;
}

export interface CongresoTrendRow {
  anio_eleccion: number;
  codigo_departamento: string;
  partido: string;
  votes: number;
}

export interface TopPartidoRow {
  partido: string;
  totalVotos: number;
  rank: number;
}

export interface MunicipioOption {
  codigo_divipola: string;
  nombre?: string;
}

export interface ElectionSummaryRow {
  year: number;
  totalVotos: number;
  partidoGanador: string;
  votosPartidoGanador: number;
}

export interface ElectionSummaryByCorporationRow {
  year: number;
  corporacion: string;
  totalVotos: number;
  partidoGanador: string;
  votosPartidoGanador: number;
}

export interface CongresoResultadoRepository {
  findPaginated(page: number, limit: number): Promise<CongresoResultado[]>;
  getCount(): Promise<number>;
  findSummaryByYearAndDepartments(
    year: number,
    codigoDepartamentos: string[],
    corporacion?: string
  ): Promise<CongresoSummaryRow[]>;
  findTrendByDepartments(
    codigoDepartamentos: string[],
    corporacion?: string
  ): Promise<{ years: number[]; rows: CongresoTrendRow[] }>;
  findYears(): Promise<number[]>;
  findCorporaciones(): Promise<string[]>;
  findTopPartidosByVotos(filters: {
    year?: number;
    corporacion?: string;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
    excludeParty?: string;
  }): Promise<TopPartidoRow[]>;
  findTotalVotosByPartido(filters: {
    year?: number;
    corporacion?: string;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
    partido: string;
  }): Promise<number>;
  findPartidosByScope(filters: {
    year?: number;
    corporacion?: string;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
  }): Promise<{ partido: string }[]>;
  findMunicipiosByDepartment(codigoDepartamento: string, year?: number): Promise<MunicipioOption[]>;
  findElectionsSummary(): Promise<ElectionSummaryRow[]>;
  findElectionsSummaryByCorporation(): Promise<ElectionSummaryByCorporationRow[]>;
  findTotalVotosByScope(filters: {
    year?: number;
    corporacion?: string;
    codigoDepartamento?: string;
    codigoMunicipio?: string;
  }): Promise<number>;
}
