import express from 'express';
import { env } from './config/env';
import { getPool, checkConnection, ensureSchema } from './infrastructure/persistence/database';
import { PostgresDepartamentoRepository } from './infrastructure/persistence/PostgresDepartamentoRepository';
import { PostgresCongresoResultadoRepository } from './infrastructure/persistence/PostgresCongresoResultadoRepository';
import { PostgresKpiGestionTeridataRepository } from './infrastructure/persistence/PostgresKpiGestionTeridataRepository';
import { PostgresKpiRealidadDaneRepository } from './infrastructure/persistence/PostgresKpiRealidadDaneRepository';
import { createApp } from './infrastructure/http/app';

async function main(): Promise<void> {
  const schema = env.db.schema || 'report';

  const pool = getPool();
  await checkConnection();
  await ensureSchema();

  const departamentoRepository = new PostgresDepartamentoRepository(pool, schema);
  const congresoResultadoRepository = new PostgresCongresoResultadoRepository(pool, schema);
  const teradataRepository = new PostgresKpiGestionTeridataRepository(pool, schema);
  const daneRepository = new PostgresKpiRealidadDaneRepository(pool, schema);
  const app = createApp(departamentoRepository, congresoResultadoRepository, teradataRepository, daneRepository);

  app.listen(env.port, () => {
    console.log(`Backend: http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
