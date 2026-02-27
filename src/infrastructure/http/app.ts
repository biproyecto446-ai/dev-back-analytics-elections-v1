import express from 'express';
import cors from 'cors';
import { createCongresoReportRoutes } from './routes/congresoReportRoutes';
import { createCongresoResultadosRoutes } from './routes/congresoResultadosRoutes';
import type { DepartamentoRepository } from '../../domain/ports/DepartamentoRepository';
import type { CongresoResultadoRepository } from '../../domain/ports/CongresoResultadoRepository';
import type { KpiGestionTeridataRepository } from '../../domain/ports/KpiGestionTeridataRepository';
import type { KpiRealidadDaneRepository } from '../../domain/ports/KpiRealidadDaneRepository';

export function createApp(
  departamentoRepository: DepartamentoRepository,
  congresoResultadoRepository: CongresoResultadoRepository,
  teradataRepository: KpiGestionTeridataRepository,
  daneRepository: KpiRealidadDaneRepository
): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(
    '/api/congreso-report',
    createCongresoReportRoutes(departamentoRepository, congresoResultadoRepository, teradataRepository, daneRepository)
  );
  app.use('/api/congreso-resultados', createCongresoResultadosRoutes(congresoResultadoRepository));

  return app;
}
