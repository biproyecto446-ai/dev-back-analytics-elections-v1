import { Pool } from 'pg';
import { env } from '../../config/env';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.username,
      password: env.db.password,
      database: env.db.database,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

/** Comprueba que la conexión a la DB funciona. */
export async function checkConnection(): Promise<void> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export async function ensureSchema(): Promise<void> {
  const p = getPool();
  await p.query(`CREATE SCHEMA IF NOT EXISTS "${env.db.schema}"`);
  await p.query(`SET search_path TO "${env.db.schema}"`);
  // Las tablas report.divi_departamentos, divi_municipio, congreso_resultados, kpis_* se asumen creadas
}
