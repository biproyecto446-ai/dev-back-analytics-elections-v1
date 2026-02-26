import { Router, type Request, type Response } from 'express';
import type { DepartamentoRepository } from '../../../domain/ports/DepartamentoRepository';
import type { CongresoResultadoRepository } from '../../../domain/ports/CongresoResultadoRepository';
import type { KpiGestionTeridataRepository } from '../../../domain/ports/KpiGestionTeridataRepository';
import { GetDepartamentosUseCase } from '../../../application/use-cases/GetDepartamentos';

const MAX_DEPTS = 3;

function parseDepartmentCodes(str: string | undefined): string[] {
  if (!str) return [];
  const codes = str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(codes)].slice(0, MAX_DEPTS);
}

/** Normaliza código de departamento para comparación (ej: "011" y "11" son iguales) */
function normDeptCode(c: string | number): string {
  return String(c).trim().replace(/^0+/, '') || '0';
}

export function createCongresoReportRoutes(
  departamentoRepository: DepartamentoRepository,
  congresoRepository: CongresoResultadoRepository,
  teradataRepository: KpiGestionTeridataRepository
): Router {
  const router = Router();
  const getDepartamentos = new GetDepartamentosUseCase(departamentoRepository);

  router.get('/departments', async (_req: Request, res: Response) => {
    try {
      const departments = await getDepartamentos.execute();
      res.json({ departments });
    } catch {
      res.status(500).json({ error: 'Error al obtener departamentos' });
    }
  });

  router.get('/years', async (_req: Request, res: Response) => {
    try {
      const years = await congresoRepository.findYears();
      res.json({ years });
    } catch {
      res.status(500).json({ error: 'Error al obtener años' });
    }
  });

  router.get('/corporations', async (_req: Request, res: Response) => {
    try {
      const corporations = await congresoRepository.findCorporaciones();
      res.json({ corporations });
    } catch {
      res.status(500).json({ error: 'Error al obtener corporaciones' });
    }
  });

  router.get('/elections-summary', async (_req: Request, res: Response) => {
    try {
      const rows = await congresoRepository.findElectionsSummaryByCorporation();
      type CorpItem = { corporacion: string; totalVotos: number; partidoGanador: string; votosPartidoGanador: number };
      const byYear = new Map<number, { year: number; corporations: CorpItem[] }>();
      for (const r of rows) {
        if (!byYear.has(r.year)) byYear.set(r.year, { year: r.year, corporations: [] });
        byYear.get(r.year)!.corporations.push({
          corporacion: r.corporacion,
          totalVotos: r.totalVotos,
          partidoGanador: r.partidoGanador,
          votosPartidoGanador: r.votosPartidoGanador,
        });
      }
      const summaries = Array.from(byYear.values()).sort((a, b) => b.year - a.year);
      res.json({ summaries });
    } catch {
      res.status(500).json({ error: 'Error al obtener resumen de elecciones' });
    }
  });

  router.get('/municipalities', async (req: Request, res: Response) => {
    try {
      const department = String(req.query.department ?? '').trim();
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      if (!department) {
        return res.json({ municipalities: [] });
      }
      const municipalities = await congresoRepository.findMunicipiosByDepartment(department, year);
      res.json({ municipalities });
    } catch {
      res.status(500).json({ error: 'Error al obtener municipios' });
    }
  });

  router.get('/parties', async (req: Request, res: Response) => {
    try {
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      const corporation = String(req.query.corporation ?? '').trim() || undefined;
      const department = String(req.query.department ?? '').trim() || undefined;
      const municipality = String(req.query.municipality ?? '').trim() || undefined;
      const parties = await congresoRepository.findPartidosByScope({
        year,
        corporacion: corporation,
        codigoDepartamento: department,
        codigoMunicipio: municipality,
      });
      res.json({ parties });
    } catch {
      res.status(500).json({ error: 'Error al obtener partidos' });
    }
  });

  router.get('/top-partidos', async (req: Request, res: Response) => {
    try {
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      const corporation = String(req.query.corporation ?? '').trim() || undefined;
      const department = String(req.query.department ?? '').trim() || undefined;
      const municipality = String(req.query.municipality ?? '').trim() || undefined;
      const excludeParty = String(req.query.excludeParty ?? '').trim() || undefined;
      const scopeFilters = { year, corporacion: corporation, codigoDepartamento: department, codigoMunicipio: municipality };
      const [rows, totalVotosAmbito, totalVotosDepartamento] = await Promise.all([
        congresoRepository.findTopPartidosByVotos({ ...scopeFilters, excludeParty }),
        congresoRepository.findTotalVotosByScope(scopeFilters),
        municipality && department
          ? congresoRepository.findTotalVotosByScope({ year, corporacion: corporation, codigoDepartamento: department })
          : Promise.resolve(null),
      ]);
      let excludedParty: { name: string; totalVotos: number } | undefined;
      if (excludeParty) {
        const totalVotos = await congresoRepository.findTotalVotosByPartido({
          ...scopeFilters,
          partido: excludeParty,
        });
        excludedParty = { name: excludeParty, totalVotos };
      }
      const payload: {
        data: typeof rows;
        excludedParty?: typeof excludedParty;
        totalVotosAmbito: number;
        totalVotosDepartamento?: number | null;
      } = { data: rows, totalVotosAmbito: totalVotosAmbito ?? 0 };
      if (excludedParty) payload.excludedParty = excludedParty;
      if (totalVotosDepartamento != null) payload.totalVotosDepartamento = totalVotosDepartamento;
      res.json(payload);
    } catch {
      res.status(500).json({ error: 'Error al obtener top partidos' });
    }
  });

  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const year = parseInt(String(req.query.year), 10) || new Date().getFullYear();
      const codes = parseDepartmentCodes(String(req.query.departments));
      const corporation = String(req.query.corporation ?? '').trim() || undefined;
      if (codes.length === 0) {
        return res.json({ year, winningByDept: [], top5ByDept: {}, top5Parties: [] });
      }
      const rows = await congresoRepository.findSummaryByYearAndDepartments(year, codes, corporation);
      const winningByDept: { codigo_departamento: string; department: string; partyName: string; totalVotes: number }[] = [];
      const top5ByDept: Record<string, { partyName: string; votes: number; pct: number }[]> = {};
      const deptNames = await getDepartamentos.execute();
      const nameByCode: Record<string, string> = {};
      deptNames.forEach((d) => {
        nameByCode[d.codigo_departamento] = d.nombre;
      });
      // Top 5 partidos con más votación (agregado de todos los departamentos seleccionados)
      const votesByParty: Record<string, number> = {};
      rows.forEach((r) => {
        const name = r.partido || '';
        if (name) votesByParty[name] = (votesByParty[name] || 0) + r.votes;
      });
      const top5Parties = Object.entries(votesByParty)
        .map(([partyName, totalVotes]) => ({ partyName, totalVotes }))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 5);
      codes.forEach((cod) => {
        const codStr = String(cod);
        const codNorm = normDeptCode(cod);
        const deptRows = rows.filter((r) => normDeptCode(r.codigo_departamento) === codNorm);
        const totalVotes = deptRows.reduce((s, r) => s + r.votes, 0);
        const winner = deptRows.find((r) => r.rn === 1);
        if (winner) {
          winningByDept.push({
            codigo_departamento: codStr,
            department: nameByCode[cod] ?? codStr,
            partyName: winner.partido,
            totalVotes: winner.votes,
          });
        }
        top5ByDept[codStr] = deptRows
          .filter((r) => r.rn <= 1)
          .map((r) => ({
            partyName: r.partido,
            votes: r.votes,
            pct: totalVotes > 0 ? (100 * r.votes) / totalVotes : 0,
          }));
      });
      res.json({ year, winningByDept, top5ByDept, top5Parties, top5ByDeptNombre: nameByCode });
    } catch {
      res.status(500).json({ error: 'Error al generar resumen' });
    }
  });

  router.get('/trend', async (req: Request, res: Response) => {
    try {
      const codes = parseDepartmentCodes(String(req.query.departments));
      const corporation = String(req.query.corporation ?? '').trim() || undefined;
      if (codes.length === 0) {
        return res.json({ years: [], series: [] });
      }
      const { years, rows } = await congresoRepository.findTrendByDepartments(codes, corporation);
      const deptNames = await getDepartamentos.execute();
      const nameByCode: Record<string, string> = {};
      deptNames.forEach((d) => {
        nameByCode[d.codigo_departamento] = d.nombre;
      });
      const series = codes.map((cod) => ({
        department: nameByCode[cod] ?? cod,
        codigo_departamento: cod,
        data: years.map((y) =>
          rows
            .filter((r) => r.anio_eleccion === y && r.codigo_departamento === cod)
            .reduce((s, r) => s + r.votes, 0)
        ),
      }));
      res.json({ years, series });
    } catch {
      res.status(500).json({ error: 'Error al generar tendencia' });
    }
  });

  router.get('/teradata-indicators', async (req: Request, res: Response) => {
    try {
      const codes = parseDepartmentCodes(String(req.query.departments));
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      if (codes.length === 0) {
        return res.json({ labels: [], series: [] });
      }
      const { indicators, rows } = await teradataRepository.findIndicatorsByDepartments(codes, year);
      const deptNames = await getDepartamentos.execute();
      const nameByCode: Record<string, string> = {};
      deptNames.forEach((d) => {
        nameByCode[d.codigo_departamento] = d.nombre;
      });
      const labels = indicators.map((ind) => ind ?? '');
      const series = codes.map((cod) => {
        const data = indicators.map((ind) => {
          const r = rows.find(
            (x) => normDeptCode(x.codigo_departamento) === normDeptCode(cod) && x.indicador === ind
          );
          return r ? r.valor : 0;
        });
        return {
          department: nameByCode[cod] ?? cod,
          codigo_departamento: cod,
          data,
        };
      });
      const dimensionByIndicator: Record<string, string> = {};
      rows.forEach((r) => {
        if (dimensionByIndicator[r.indicador] == null) {
          dimensionByIndicator[r.indicador] = r.dimension ?? 'Otros';
        }
      });
      const dimensionToIndices: Record<string, number[]> = {};
      indicators.forEach((ind, idx) => {
        const dim = dimensionByIndicator[ind] ?? 'Otros';
        if (!dimensionToIndices[dim]) dimensionToIndices[dim] = [];
        dimensionToIndices[dim].push(idx);
      });
      const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const shortLabel = (s: string, maxLen = 22): string => {
        const t = s.trim();
        if (t.length <= maxLen) return t;
        const byWords = t.split(/\s+/).slice(0, 3).join(' ');
        return byWords.length > maxLen ? byWords.substring(0, maxLen - 1) + '…' : byWords;
      };
      const groups = Object.entries(dimensionToIndices)
        .map(([nombreCompleto, indicatorIndices]) => ({
          id: slug(nombreCompleto),
          label: shortLabel(nombreCompleto),
          fullLabel: nombreCompleto,
          indicatorIndices,
        }))
        .filter((g) => g.indicatorIndices.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label));
      res.json({ groups, labels, series });
    } catch {
      res.status(500).json({ error: 'Error al obtener indicadores Teradata' });
    }
  });

  return router;
}
