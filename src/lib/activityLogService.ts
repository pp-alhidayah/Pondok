import { storage } from './storage';
import { generateId, readJsonStrict } from './core';

export const ACTIVITY_LOG_KEY = 'al_hidayah_activity_log';
const MAX_ENTRIES = 500;

export type ActivityModul =
  | 'Santri'
  | 'Pendaftaran'
  | 'Syahriyah'
  | 'Kilatan'
  | 'Iuran'
  | 'Kas'
  | 'Pengaturan'
  | 'Sistem';

export type ActivityAksi =
  | 'Tambah'
  | 'Ubah'
  | 'Hapus'
  | 'Impor'
  | 'Pembayaran'
  | 'Pembatalan'
  | 'Restore'
  | 'Login';

export interface ActivityLogEntry {
  id: string;
  waktu: string; // ISO
  modul: ActivityModul;
  aksi: ActivityAksi;
  deskripsi: string;
  ref_id?: string;
  user?: string;
}

export interface CatatActivityInput {
  modul: ActivityModul;
  aksi: ActivityAksi;
  deskripsi: string;
  ref_id?: string;
}

/** Baca username dari sesi tanpa memvalidasi ke daftar akun (cukup untuk label riwayat). */
function currentUsername(): string | undefined {
  try {
    const raw = storage.getItem('al_hidayah_auth_user');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { username?: unknown } | null;
    return parsed && typeof parsed.username === 'string' ? parsed.username : undefined;
  } catch {
    return undefined;
  }
}

export const activityLogService = {
  /**
   * Catat satu aktivitas. Kegagalan pencatatan TIDAK boleh menggagalkan
   * aksi utama, sehingga semua error ditelan di sini.
   */
  catat(input: CatatActivityInput): void {
    try {
      const list = readJsonStrict<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
      const entry: ActivityLogEntry = {
        id: generateId('log'),
        waktu: new Date().toISOString(),
        user: currentUsername(),
        ...input,
      };
      storage.setItem(ACTIVITY_LOG_KEY, JSON.stringify([entry, ...list].slice(0, MAX_ENTRIES)));
    } catch {
      // abaikan: riwayat aktivitas bersifat pelengkap
    }
  },

  getAll(): ActivityLogEntry[] {
    return readJsonStrict<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []).sort((a, b) =>
      (b.waktu || '').localeCompare(a.waktu || '')
    );
  },

  clear(): void {
    storage.removeItem(ACTIVITY_LOG_KEY);
  },
};
