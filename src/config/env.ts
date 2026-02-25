import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 3001,
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) ?? 5432,
    username: process.env.DB_USERNAME ?? 'postgres',
    password: (process.env.DB_PASSWORD ?? '').replace(/^"|"$/g, ''),
    database: process.env.DB_DATABASE ?? 'db_will',
    schema: process.env.DB_SCHEMA ?? 'report',
  },
} as const;
