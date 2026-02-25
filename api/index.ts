import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool, checkConnection, ensureSchema } from '../src/infrastructure/persistence/database';
import { env } from '../src/config/env';
import { PostgresDepartamentoRepository } from '../src/infrastructure/persistence/PostgresDepartamentoRepository';
import { PostgresCongresoResultadoRepository } from '../src/infrastructure/persistence/PostgresCongresoResultadoRepository';
import { PostgresKpiGestionTeridataRepository } from '../src/infrastructure/persistence/PostgresKpiGestionTeridataRepository';
import { createApp } from '../src/infrastructure/http/app';
import type { Express } from 'express';

let appPromise: Promise<Express> | null = null;

async function getApp(): Promise<Express> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    const schema = env.db.schema || 'report';
    const pool = getPool();
    await checkConnection();
    await ensureSchema();
    const departamentoRepository = new PostgresDepartamentoRepository(pool, schema);
    const congresoResultadoRepository = new PostgresCongresoResultadoRepository(pool, schema);
    const teradataRepository = new PostgresKpiGestionTeridataRepository(pool, schema);
    return createApp(departamentoRepository, congresoResultadoRepository, teradataRepository);
  })();
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const app = await getApp();
  app(req as any, res);
}
