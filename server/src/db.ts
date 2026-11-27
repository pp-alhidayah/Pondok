import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';
import { config, isProduction } from './config';

export const pool: Pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Sistem memakai waktu lokal WIB; jangan biarkan driver mengonversi UTC.
  timezone: 'local',
  charset: 'utf8mb4',
  namedPlaceholders: false,
});

export type Rows = RowDataPacket[];

export async function query<T extends RowDataPacket[]>(sql: string, params: any[] = []): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

export async function execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as ResultSetHeader;
}

/**
 * Jalankan beberapa pernyataan dalam SATU transaksi InnoDB.
 * Semua kegagalan di-rollback — pengganti snapshotKeys di sisi frontend.
 */
export async function withTransaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function checkDatabase(): Promise<void> {
  await query('SELECT 1 AS ok', []);
}

if (isProduction) {
  pool.on('connection', (conn) => {
    conn.on('error', () => {
      // Koneksi mati akan dibuang pool; hindarkan process crash karena event error.
    });
  });
}
