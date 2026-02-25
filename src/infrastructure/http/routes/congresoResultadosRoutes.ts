import { Router, type Request, type Response } from 'express';
import type { CongresoResultadoRepository } from '../../../domain/ports/CongresoResultadoRepository';

export function createCongresoResultadosRoutes(repository: CongresoResultadoRepository): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
      const limit = Math.min(2000, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
      const data = await repository.findPaginated(page, limit);
      res.json({ data, page, limit });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al obtener congreso_resultados' });
    }
  });

  router.get('/count', async (_req: Request, res: Response) => {
    try {
      const total = await repository.getCount();
      res.json({ total });
    } catch {
      res.status(500).json({ error: 'Error al obtener total' });
    }
  });

  return router;
}
