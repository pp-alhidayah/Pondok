import cors from 'cors';
import express from 'express';
import { loadSession, requireCsrf } from './auth';
import { config } from './config';
import { checkDatabase, query } from './db';
import { asyncHandler, errorHandler } from './errors';
import { aktivitasRoutes } from './routes/aktivitasRoutes';
import { authRoutes } from './routes/authRoutes';
import { laporanRoutes } from './routes/laporanRoutes';
import { masterRoutes } from './routes/masterRoutes';
import { pembayaranRoutes } from './routes/pembayaranRoutes';
import { keringananRoutes } from './routes/keringananRoutes';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(loadSession);

  app.get('/health', asyncHandler(async (_req, res) => {
    await checkDatabase();
    const rows = await query('SELECT 1 AS ok');
    res.json({ status: 'ok', database: rows[0]?.ok === 1 });
  }));

  const api = express.Router();

  // Endpoint auth tidak memakai CSRF (belum punya sesi saat login/setup).
  api.use('/auth', authRoutes);

  // Semua mutation lain wajib menyertakan header x-csrf-token dari /api/auth/me.
  api.use(requireCsrf);
  api.use('/pembayaran', pembayaranRoutes);
  api.use('/keringanan', keringananRoutes);
  api.use('/master', masterRoutes);
  api.use('/laporan', laporanRoutes);
  api.use('/', aktivitasRoutes);

  app.use('/api', api);
  app.use(errorHandler);

  return app;
}
