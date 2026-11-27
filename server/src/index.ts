import { createApp } from './app';
import { checkDatabase } from './db';
import { config } from './config';

async function main(): Promise<void> {
  await checkDatabase();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`API Pondok Al Hidayah berjalan di http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Gagal menjalankan server:', error);
  process.exit(1);
});
