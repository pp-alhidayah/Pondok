import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from './config';
import { execute, pool } from './db';

async function pastikanDatabase(): Promise<void> {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();
}

/**
 * Jalankan DDL dari blok ```sql di MIGRASI_DB.md — satu sumber kebenaran
 * supaya dokumentasi dan schema database tidak bisa berbeda.
 */
async function migrate(): Promise<void> {
  await pastikanDatabase();
  const docPath = fileURLToPath(new URL('../../MIGRASI_DB.md', import.meta.url));
  const markdown = await readFile(docPath, 'utf8');
  const match = /```sql\r?\n([\s\S]*?)```/.exec(markdown);
  if (!match) throw new Error('Blok DDL SQL tidak ditemukan di MIGRASI_DB.md');

  // Buang baris komentar DULU, baru pecah per ';' — komentar boleh mengandung ';'.
  const tanpaKomentar = match[1]
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = tanpaKomentar
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await execute(statement);
  }

  await pool.end();
  console.log(`Schema berhasil diterapkan (${statements.length} statement).`);
}

migrate().catch((error) => {
  console.error('Migrasi gagal:', error);
  process.exit(1);
});
