import dotenv from 'dotenv';

dotenv.config();

const numberFrom = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: numberFrom(process.env.PORT, 3001),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: numberFrom(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'al_hidayah',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-session-secret',
  sessionTtlHours: numberFrom(process.env.SESSION_TTL_HOURS, 12),
};

export const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && config.sessionSecret === 'dev-only-session-secret') {
  throw new Error('SESSION_SECRET wajib diganti di produksi');
}
