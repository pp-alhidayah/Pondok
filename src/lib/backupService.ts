import { storage } from './storage';
/**
 * Backup & restore data Pondok Al Hidayah.
 *
 * Prinsip:
 * - Hanya key data aplikasi yang dikenal yang boleh dibackup/direstore.
 * - Sesi login (auth), event toast, dan key legacy TIDAK ikut dibackup agar
 *   restore tidak menimpa/menghidupkan sesi lama.
 * - File asing atau struktur data yang rusak ditolak seluruhnya; tidak ada
 *   penulisan sebagian yang bisa membuat data setengah pulih.
 */

export const BACKUP_APP_ID = 'pondok-al-hidayah';
export const BACKUP_VERSION = 1;

import { isValidCalendarDate, isValidYearMonth } from './core';

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BackupEnvelope {
  app: typeof BACKUP_APP_ID;
  version: typeof BACKUP_VERSION;
  created_at: string;
  data: Record<string, unknown>;
}

type Validator = (value: unknown) => boolean;

interface BackupSpec {
  label: string;
  validate: Validator;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isStringArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const arrayOfRecords =
  (requiredKeys: string[]): Validator =>
  (value: unknown): boolean =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        isPlainObject(item) &&
        requiredKeys.every(
          (key) => typeof item[key] === 'string' && (item[key] as string).trim() !== ''
        )
    );

const isNomorKuitansi = (value: unknown): boolean =>
  isPlainObject(value) &&
  Object.values(value).every(
    (item) => typeof item === 'number' && Number.isFinite(item) && item >= 0
  );

const isKategoriKas = (value: unknown): boolean =>
  isPlainObject(value) && isStringArray(value.pemasukan) && isStringArray(value.pengeluaran);

const isUserArray: Validator = (value) =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      isPlainObject(item) &&
      typeof item.username === 'string' &&
      item.username.trim() !== '' &&
      ['super_admin', 'admin', 'pemilik'].includes(String(item.role)) &&
      ['Aktif', 'Nonaktif'].includes(String(item.status))
  );

const isCalendarDate = (value: unknown): boolean =>
  typeof value === 'string' && isValidCalendarDate(value);

const isNonNegativeNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const STATUS_BAYAR = ['Lunas', 'Sebagian', 'Belum'];
const EVENT_KILATAN = ['Jumadil Ula', 'Maulid', 'Romadhon', 'Dzulhijjah'];

/** Matriks: { [santriId]: { [tahun]: BarisBulan[] | BarisEvent[] } } */
const isMatrix =
  (field: 'bulan' | 'event'): Validator =>
  (value) =>
    isPlainObject(value) &&
    Object.values(value).every(
      (years) =>
        isPlainObject(years) &&
        Object.entries(years).every(([year, rows]) => {
          if (!/^\d{4}$/.test(year) || !Array.isArray(rows)) return false;
          return rows.every((row) => {
            if (!isPlainObject(row)) return false;
            const key = row[field];
            const keyValid =
              field === 'bulan'
                ? typeof key === 'number' && key >= 1 && key <= 12
                : typeof key === 'string' && EVENT_KILATAN.includes(key);
            return (
              keyValid &&
              Number.isInteger(row.tahun) &&
              isNonNegativeNumber(row.nominal_tagihan) &&
              isNonNegativeNumber(row.total_dibayar) &&
              STATUS_BAYAR.includes(String(row.status))
            );
          });
        })
    );

const isTransaksiBayar: Validator = (value) =>
  Array.isArray(value) &&
  value.every((item) => {
    if (!isPlainObject(item)) return false;
    const data = item.transaksi_data;
    return (
      typeof item.id === 'string' &&
      Array.isArray(item.items) &&
      isPlainObject(data) &&
      isCalendarDate((data as Record<string, unknown>).tanggal_bayar) &&
      isNonNegativeNumber(item.total_pembayaran)
    );
  });

const isProfil: Validator = (value) =>
  isPlainObject(value) &&
  ['nama_pondok', 'alamat', 'pengasuh', 'ketua', 'bendahara'].every(
    (key) => typeof value[key] === 'string'
  ) &&
  ['sekretaris', 'kontak', 'email', 'logo'].every(
    (key) => value[key] === undefined || typeof value[key] === 'string'
  );

const isTarif: Validator = (value) =>
  isPlainObject(value) &&
  ['syahriyah_mukim', 'syahriyah_nduduk', 'syahriyah_kilatan', 'event_kilatan'].every((key) =>
    isNonNegativeNumber(value[key])
  ) &&
  (value.periode_mulai === undefined || isValidYearMonth(String(value.periode_mulai)));

const isPrintLogs: Validator = (value) =>
  isPlainObject(value) &&
  Object.values(value).every(
    (logs) =>
      Array.isArray(logs) &&
      logs.every((log) => isPlainObject(log) && typeof log.id === 'string')
  );

export const BACKUP_SPECS: Record<string, BackupSpec> = {
  al_hidayah_santri: { label: 'Data santri', validate: arrayOfRecords(['id']) },
  al_hidayah_pendaftaran: { label: 'Data pendaftaran', validate: arrayOfRecords(['id']) },
  al_hidayah_syahriyah: { label: 'Matriks syahriyah', validate: isMatrix('bulan') },
  al_hidayah_syahriyah_transaksi: {
    label: 'Transaksi syahriyah',
    validate: isTransaksiBayar,
  },
  al_hidayah_kilatan: { label: 'Matriks kilatan', validate: isMatrix('event') },
  al_hidayah_kilatan_transaksi: {
    label: 'Transaksi kilatan',
    validate: isTransaksiBayar,
  },
  al_hidayah_kas: { label: 'Buku kas', validate: arrayOfRecords(['id']) },
  al_hidayah_kategori_kas: { label: 'Kategori kas', validate: isKategoriKas },
  al_hidayah_profil: { label: 'Profil pondok', validate: isProfil },
  al_hidayah_syahriyah_waivers: {
    label: 'Keringanan syahriyah',
    validate: arrayOfRecords(['id', 'santri_id']),
  },
  al_hidayah_tarif: { label: 'Tarif', validate: isTarif },
  al_hidayah_arsip_tarif: { label: 'Arsip tarif', validate: arrayOfRecords(['id']) },
  al_hidayah_users: { label: 'Akun pengguna', validate: isUserArray },
  al_hidayah_master_iuran: {
    label: 'Master iuran',
    validate: arrayOfRecords(['id', 'nama']),
  },
  al_hidayah_iuran_pembayaran: {
    label: 'Pembayaran iuran',
    validate: arrayOfRecords(['id', 'iuran_id']),
  },
  al_hidayah_iuran_tambahan: {
    label: 'Iuran tambahan',
    validate: arrayOfRecords(['id', 'nama']),
  },
  al_hidayah_nomor_kuitansi: { label: 'Nomor kuitansi', validate: isNomorKuitansi },
  al_hidayah_kwitansi_config: { label: 'Pengaturan kuitansi', validate: isPlainObject },
  al_hidayah_kop_surat: {
    label: 'Desain kop surat',
    validate: (value) =>
      isPlainObject(value) && isPlainObject(value.config), // { version, config, image }
  },
  al_hidayah_print_logs: {
    label: 'Riwayat status cetak',
    validate: isPrintLogs,
  },
  al_hidayah_activity_log: {
    label: 'Riwayat aktivitas',
    validate: arrayOfRecords(['id', 'waktu', 'modul', 'aksi']),
  },
};

export const BACKUP_KEYS = Object.keys(BACKUP_SPECS);

/**
 * Key yang sengaja tidak dipulihkan. Key ini boleh ada di file backup lama,
 * tetapi nilainya tidak akan pernah ditulis kembali ke storage.
 */
const IGNORED_BACKUP_KEYS = new Set([
  'al_hidayah_auth_user',
  'al_hidayah_toast_event',
  'hidayah_auth_user',
  'user',
]);

export type BackupValidation =
  | { ok: true; data: Record<string, unknown>; ignored: string[] }
  | { ok: false; message: string };

const fail = (message: string): BackupValidation => ({ ok: false, message });

/** Susun objek backup dari key data yang dikenal saja. */
export function buildBackup(sumber: StorageLike = storage): BackupEnvelope {
  const data: Record<string, unknown> = {};

  for (const key of BACKUP_KEYS) {
    const raw = sumber.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      throw new Error(
        `Data "${BACKUP_SPECS[key].label}" rusak sehingga backup tidak dapat dibuat.`
      );
    }
  }

  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    data,
  };
}

/**
 * Validasi relasi antar-kunci. Dijalankan setelah validator per-key agar
 * backup dengan ID yatim tidak pernah bisa dipulihkan.
 */
function validateRelations(data: Record<string, unknown>): string | null {
  const santri = data.al_hidayah_santri;
  const daftarSantri = Array.isArray(santri) ? (santri as Array<Record<string, unknown>>) : null;
  const idsSantri = new Set((daftarSantri || []).map((s) => String(s.id)));
  const cekSantri = (id: unknown, label: string): string | null => {
    if (!daftarSantri || typeof id !== 'string' || !id) return null;
    if (!idsSantri.has(id)) return `${label} menunjuk santri "${id}" yang tidak ada`;
    return null;
  };

  if (daftarSantri) {
    for (const key of ['al_hidayah_syahriyah', 'al_hidayah_kilatan']) {
      const matriks = data[key];
      if (!isPlainObject(matriks)) continue;
      for (const santriId of Object.keys(matriks)) {
        const error = cekSantri(santriId, 'Matriks tagihan');
        if (error) return error;
      }
    }
    for (const key of ['al_hidayah_syahriyah_transaksi', 'al_hidayah_kilatan_transaksi']) {
      const transaksi = data[key];
      if (!Array.isArray(transaksi)) continue;
      for (const row of transaksi as Array<Record<string, unknown>>) {
        const error = cekSantri(row.santri_id, 'Transaksi pembayaran');
        if (error) return error;
      }
    }
    const pembayaranIuran = data.al_hidayah_iuran_pembayaran;
    if (Array.isArray(pembayaranIuran)) {
      for (const row of pembayaranIuran as Array<Record<string, unknown>>) {
        const error = cekSantri(row.santri_id, 'Pembayaran iuran');
        if (error) return error;
      }
    }
    const waivers = data.al_hidayah_syahriyah_waivers;
    if (Array.isArray(waivers)) {
      for (const row of waivers as Array<Record<string, unknown>>) {
        const error = cekSantri(row.santri_id, 'Keringanan syahriyah');
        if (error) return error;
      }
    }
    const pendaftaran = data.al_hidayah_pendaftaran;
    if (Array.isArray(pendaftaran)) {
      for (const row of pendaftaran as Array<Record<string, unknown>>) {
        const error = cekSantri(row.santri_id, 'Pendaftaran');
        if (error) return error;
      }
    }
  }

  const masterIuran = data.al_hidayah_master_iuran;
  if (Array.isArray(masterIuran)) {
    const ids = new Set((masterIuran as Array<Record<string, unknown>>).map((m) => String(m.id)));
    const pembayaran = data.al_hidayah_iuran_pembayaran;
    if (Array.isArray(pembayaran)) {
      for (const row of pembayaran as Array<Record<string, unknown>>) {
        if (typeof row.iuran_id === 'string' && row.iuran_id && !ids.has(row.iuran_id)) {
          return `Pembayaran iuran menunjuk program "${row.iuran_id}" yang tidak ada`;
        }
      }
    }
  }

  const kas = data.al_hidayah_kas;
  const transaksiIds = new Set<string>();
  for (const key of ['al_hidayah_syahriyah_transaksi', 'al_hidayah_kilatan_transaksi']) {
    const transaksi = data[key];
    if (Array.isArray(transaksi)) {
      (transaksi as Array<Record<string, unknown>>).forEach((row) => {
        if (typeof row.id === 'string') transaksiIds.add(row.id);
      });
    }
  }
  const pembayaranIuran = data.al_hidayah_iuran_pembayaran;
  if (Array.isArray(pembayaranIuran)) {
    (pembayaranIuran as Array<Record<string, unknown>>).forEach((row) => {
      if (typeof row.id === 'string') transaksiIds.add(row.id);
    });
  }
  if (Array.isArray(kas)) {
    for (const row of kas as Array<Record<string, unknown>>) {
      const sumber = row.sumber;
      if (isPlainObject(sumber) && typeof sumber.ref_id === 'string' && !transaksiIds.has(sumber.ref_id)) {
        return `Entri kas menunjuk transaksi "${sumber.ref_id}" yang tidak ada`;
      }
    }
  }

  return null;
}

/**
 * Validasi file backup. Mendukung format amplop baru dan format datar (backup
 * lama), tetapi selalu menolak file asing dan struktur data yang tidak valid.
 */
export function validateBackup(raw: unknown): BackupValidation {
  if (!isPlainObject(raw)) {
    return fail('File backup harus berupa objek JSON.');
  }

  let source: unknown;
  const maybeEnvelope = raw as Record<string, unknown>;

  if ('app' in maybeEnvelope || 'data' in maybeEnvelope || 'version' in maybeEnvelope) {
    if (maybeEnvelope.app !== BACKUP_APP_ID) {
      return fail('File ini bukan backup aplikasi Pondok Al Hidayah.');
    }
    if (maybeEnvelope.version !== BACKUP_VERSION) {
      return fail(
        `Versi backup (${String(maybeEnvelope.version)}) tidak didukung aplikasi ini.`
      );
    }
    source = maybeEnvelope.data;
  } else {
    // Kompatibilitas backup lama: seluruh key data berada di level atas.
    source = raw;
  }

  if (!isPlainObject(source)) {
    return fail('Struktur data backup tidak valid.');
  }

  const data: Record<string, unknown> = {};
  const ignored: string[] = [];
  const unknownKeys: string[] = [];

  for (const [key, value] of Object.entries(source)) {
    if (key in BACKUP_SPECS) {
      if (!BACKUP_SPECS[key].validate(value)) {
        return fail(`Struktur data "${BACKUP_SPECS[key].label}" tidak valid.`);
      }
      data[key] = value;
    } else if (IGNORED_BACKUP_KEYS.has(key)) {
      ignored.push(key);
    } else {
      unknownKeys.push(key);
    }
  }

  if (Object.keys(data).length === 0) {
    return fail('File backup tidak berisi data aplikasi yang dikenali.');
  }

  if (unknownKeys.length > 0) {
    return fail(
      `File backup berisi data yang tidak dikenal: ${unknownKeys.slice(0, 5).join(', ')}${
        unknownKeys.length > 5 ? ', …' : ''
      }`
    );
  }

  const relationError = validateRelations(data);
  if (relationError) return fail(relationError);

  return { ok: true, data, ignored };
}

/**
 * Pulihkan data. Penulisan dilakukan setelah seluruh file lolos validasi dan
 * di-rollback bila ada kegagalan di tengah proses.
 */
export function restoreBackup(
  raw: unknown,
  tujuan: StorageLike = storage
): { restored: number; ignored: string[] } {
  const validation = validateBackup(raw);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const entries = Object.entries(validation.data);
  const snapshot = entries.map(([key]) => [key, tujuan.getItem(key)] as const);

  try {
    for (const [key, value] of entries) {
      tujuan.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    for (const [key, previous] of snapshot) {
      if (previous === null) tujuan.removeItem(key);
      else tujuan.setItem(key, previous);
    }
    throw error;
  }

  return { restored: entries.length, ignored: validation.ignored };
}
