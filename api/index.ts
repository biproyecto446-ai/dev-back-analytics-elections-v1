import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Application } from 'express';
import { getPool, checkConnection, ensureSchema } from '../src/infrastructure/persistence/database';
import { env } from '../src/config/env';
import { PostgresDepartamentoRepository } from '../src/infrastructure/persistence/PostgresDepartamentoRepository';
import { PostgresCongresoResultadoRepository } from '../src/infrastructure/persistence/PostgresCongresoResultadoRepository';
import { PostgresKpiGestionTeridataRepository } from '../src/infrastructure/persistence/PostgresKpiGestionTeridataRepository';
import { PostgresKpiRealidadDaneRepository } from '../src/infrastructure/persistence/PostgresKpiRealidadDaneRepository';
import { createApp } from '../src/infrastructure/http/app';

let appPromise: Promise<Application> | null = null;

async function getApp(): Promise<Application> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    const schema = env.db.schema || 'report';
    const pool = getPool();
    await checkConnection();
    await ensureSchema();
    const departamentoRepository = new PostgresDepartamentoRepository(pool, schema);
    const congresoResultadoRepository = new PostgresCongresoResultadoRepository(pool, schema);
    const teradataRepository = new PostgresKpiGestionTeridataRepository(pool, schema);
    const daneRepository = new PostgresKpiRealidadDaneRepository(pool, schema);
    return createApp(departamentoRepository, congresoResultadoRepository, teradataRepository, daneRepository);
  })();
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const app = await getApp();
  app(req as any, res);
}
