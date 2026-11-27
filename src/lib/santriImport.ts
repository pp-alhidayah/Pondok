import { KategoriSantri, StatusSantri } from '../types/santri';
import { isValidCalendarDate } from './core';

/** Satu baris data santri hasil pembacaan file impor. */
export interface SantriImportRowInput {
  nis?: string;
  nama: string;
  nama_wali?: string;
  no_hp_santri?: string;
  no_hp_wali?: string;
  kategori?: string;
  status?: string;
  tanggal_masuk?: string;
  catatan?: string;
}

export interface SantriImportRow {
  /** Nomor baris di spreadsheet (baris 1 = header). */
  row: number;
  data: SantriImportRowInput;
}

export interface SantriImportError {
  row: number;
  message: string;
}

export interface ParsedSantriImport {
  rows: SantriImportRow[];
  errors: SantriImportError[];
}

/**
 * Alias header yang diterima. Header dinormalisasi (huruf kecil, tanpa spasi/tanda baca)
 * supaya "Nama Wali", "nama_wali", dan "NAMA WALI" sama-sama dikenali.
 */
const HEADER_ALIASES: Record<keyof SantriImportRowInput, string[]> = {
  nis: ['nis', 'nomorinduk', 'nomorinduksantri', 'noinduk'],
  nama: ['nama', 'namasantri', 'namalengkap'],
  nama_wali: ['namawali', 'wali', 'namaorangtua', 'orangtua'],
  no_hp_santri: ['nohpsantri', 'hpsantri', 'nohp', 'teleponsantri', 'whatsappsantri'],
  no_hp_wali: ['nohpwali', 'hpwali', 'teleponwali', 'whatsappwali'],
  kategori: ['kategori', 'kategorisantri'],
  status: ['status', 'statussantri'],
  tanggal_masuk: ['tanggalmasuk', 'tglmasuk', 'tanggalmasuksantri'],
  catatan: ['catatan', 'keterangan'],
};

const KATEGORI_SAH: KategoriSantri[] = ['Mukim', 'Nduduk', 'Kilatan'];

export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Kunci duplikat data: nama + NIS harus **keduanya** sama.
 * Nama dibandingkan tanpa memperhatikan huruf besar/kecil, NIS tanpa spasi.
 * Baris dengan NIS kosong tidak bisa dicek di sini (NIS akan dibuat otomatis saat simpan).
 */
export function kunciDuplikatSantri(nama: string, nis: string): string {
  return `${nama.trim().toLowerCase()}|${nis.trim().toLowerCase()}`;
}

function pick(row: Record<string, unknown>, key: keyof SantriImportRowInput): unknown {
  for (const [header, value] of Object.entries(row)) {
    const normalized = normalizeHeader(header);
    if (HEADER_ALIASES[key].includes(normalized)) return value;
  }
  return undefined;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value);
  return String(value).replace(/\s+/g, ' ').trim();
}

export function formatDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Normalisasi tanggal: Date, YYYY-MM-DD, atau DD/MM/YYYY → YYYY-MM-DD. */
export function normalizeTanggal(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value);
  const raw = text(value);
  if (!raw) return '';
  if (isValidCalendarDate(raw)) return raw;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return raw;
}

export function normalizeKategori(value: unknown): KategoriSantri {
  const raw = text(value).toLowerCase();
  const found = KATEGORI_SAH.find((k) => k.toLowerCase() === raw);
  return found ?? 'Mukim';
}

export function normalizeStatus(value: unknown): StatusSantri {
  const raw = text(value).toLowerCase();
  if (raw === 'tidak aktif' || raw === 'nonaktif' || raw === 'non-aktif' || raw === 'inactive') {
    return 'Tidak Aktif';
  }
  return 'Aktif';
}

/**
 * Ubah baris mentah spreadsheet menjadi data santri siap impor.
 * Baris kosong dilewati; baris tanpa nama dicatat sebagai error (tidak memblokir baris lain).
 */
export function parseSantriImportRows(rawRows: Record<string, unknown>[]): ParsedSantriImport {
  const rows: SantriImportRow[] = [];
  const errors: SantriImportError[] = [];
  const nisTerlihat = new Map<string, number>();
  const kombinasiTerlihat = new Map<string, number>();

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // baris 1 = header
    const nama = text(pick(raw, 'nama'));
    const nis = text(pick(raw, 'nis'));

    const semuaKosong = Object.values(raw).every((v) => text(v) === '');
    if (semuaKosong) return;

    if (!nama) {
      errors.push({ row: rowNumber, message: 'Nama santri wajib diisi' });
      return;
    }

    if (nis) {
      // Duplikat benar-benar ganda: nama DAN NIS sama → tolak lebih dulu dengan pesan spesifik.
      const kunciData = kunciDuplikatSantri(nama, nis);
      const duplikatData = kombinasiTerlihat.get(kunciData);
      if (duplikatData) {
        errors.push({
          row: rowNumber,
          message: `Data dengan NIS ${nis} dan nama ${nama} duplikat dengan baris ${duplikatData}`,
        });
        return;
      }
      kombinasiTerlihat.set(kunciData, rowNumber);

      // NIS tetap unik walaupun namanya berbeda (aturan lama dipertahankan).
      const key = nis.toLowerCase();
      const existing = nisTerlihat.get(key);
      if (existing) {
        errors.push({ row: rowNumber, message: `NIS ${nis} duplikat dengan baris ${existing}` });
        return;
      }
      nisTerlihat.set(key, rowNumber);
    }

    rows.push({
      row: rowNumber,
      data: {
        nis: nis || undefined,
        nama,
        nama_wali: text(pick(raw, 'nama_wali')) || undefined,
        no_hp_santri: text(pick(raw, 'no_hp_santri')) || undefined,
        no_hp_wali: text(pick(raw, 'no_hp_wali')) || undefined,
        kategori: normalizeKategori(pick(raw, 'kategori')),
        status: normalizeStatus(pick(raw, 'status')),
        tanggal_masuk: normalizeTanggal(pick(raw, 'tanggal_masuk')) || undefined,
        catatan: text(pick(raw, 'catatan')) || undefined,
      },
    });
  });

  return { rows, errors };
}
