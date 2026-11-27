import { storage } from './storage';
/**
 * Service Desain Kop Surat.
 *
 * Menyimpan konfigurasi desain + gambar kop (dataURL PNG) di storage
 * dengan key `al_hidayah_kop_surat` (terdaftar di BACKUP_SPECS agar ikut
 * Backup & Restore). Gambar ini dipakai `buildLaporanPdfDoc()` untuk
 * menumpuk kop di atas PDF laporan/rekap.
 */

import {
  KopFont,
  KopLineConfig,
  KopLogoConfig,
  KopSuratConfig,
  KopSuratStorage,
  KopTextRow,
  KOP_STORAGE_KEY,
} from '../types/kopSurat';
import { pengaturanService } from './pengaturanService';

/* ============ helper normalisasi (pola seperti normalizeProfil) ============ */

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const strOr = (v: unknown, fb: string): string => (typeof v === 'string' ? v : fb);

const numOr = (v: unknown, fb: number, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fb;
  return Math.min(max, Math.max(min, n));
};

const boolOr = (v: unknown, fb: boolean): boolean => (typeof v === 'boolean' ? v : fb);

const oneOf = <T extends string>(v: unknown, allowed: T[], fb: T): T =>
  (allowed as string[]).includes(v as string) ? (v as T) : fb;

/* ============ normalisasi ============ */

const KOP_FONTS: KopFont[] = [
  'Arial, sans-serif',
  "'Times New Roman', serif",
  'Georgia, serif',
  'Verdana, sans-serif',
  "'Segoe UI', sans-serif",
  'Helvetica, sans-serif',
  'Calibri, sans-serif',
  "'Trebuchet MS', sans-serif",
  'Impact, sans-serif',
];

function normalizeTextRow(value: unknown, fallback: KopTextRow): KopTextRow {
  const raw = isObj(value) ? value : {};
  return {
    visible: boolOr(raw.visible, fallback.visible),
    text: strOr(raw.text, fallback.text ?? ''),
    font: oneOf(raw.font, KOP_FONTS, fallback.font),
    size: numOr(raw.size, fallback.size, 8, 48),
    bold: boolOr(raw.bold, fallback.bold),
    italic: boolOr(raw.italic, fallback.italic),
    uppercase: boolOr(raw.uppercase, fallback.uppercase),
    letterSpacing: numOr(raw.letterSpacing, fallback.letterSpacing, -2, 12),
    lineHeight: numOr(raw.lineHeight, fallback.lineHeight, 0.8, 3),
    marginBottom: numOr(raw.marginBottom, fallback.marginBottom, 0, 20),
    color: strOr(raw.color, fallback.color),
    opacity: numOr(raw.opacity, fallback.opacity, 30, 100),
    align: oneOf(raw.align, ['global', 'left', 'center', 'right'], fallback.align),
  };
}

function normalizeLogo(value: unknown, fallback: KopLogoConfig): KopLogoConfig {
  const raw = isObj(value) ? value : {};
  const dataUrl = strOr(raw.dataUrl, '');
  return {
    visible: boolOr(raw.visible, fallback.visible),
    dataUrl: dataUrl.startsWith('data:image/') ? dataUrl : null,
    size: numOr(raw.size, fallback.size, 30, 200),
    marginX: numOr(raw.marginX, fallback.marginX, 0, 60),
    marginTop: numOr(raw.marginTop, fallback.marginTop, 0, 60),
    shape: oneOf(raw.shape, ['asli', 'bulat', 'membulat'], fallback.shape),
    bg: oneOf(raw.bg, ['transparan', 'putih', 'warna'], fallback.bg),
    bgColor: strOr(raw.bgColor, fallback.bgColor),
  };
}

function normalizeGaris(value: unknown, fallback: KopLineConfig): KopLineConfig {
  const raw = isObj(value) ? value : {};
  return {
    visible: boolOr(raw.visible, fallback.visible),
    jenis: oneOf(raw.jenis, ['solid', 'double', 'dashed', 'dotted'], fallback.jenis),
    tebal: numOr(raw.tebal, fallback.tebal, 1, 12),
    jarakTeks: numOr(raw.jarakTeks, fallback.jarakTeks, 0, 40),
    lebar: numOr(raw.lebar, fallback.lebar, 10, 100),
    warna: strOr(raw.warna, fallback.warna),
    jarakGaris: numOr(raw.jarakGaris, fallback.jarakGaris, 1, 20),
  };
}

function normalizeKopConfig(value: unknown): KopSuratConfig {
  const d = DEFAULT_KOP_CONFIG;
  const raw = isObj(value) ? value : {};
  return {
    version: 1,
    namaYayasan: strOr(raw.namaYayasan, d.namaYayasan),
    namaPondok: strOr(raw.namaPondok, d.namaPondok),
    subUnit: strOr(raw.subUnit, d.subUnit),
    alamat: strOr(raw.alamat, d.alamat),
    telepon: strOr(raw.telepon, d.telepon),
    email: strOr(raw.email, d.email),
    website: strOr(raw.website, d.website),
    kodePos: strOr(raw.kodePos, d.kodePos),
    barisYayasan: normalizeTextRow(raw.barisYayasan, d.barisYayasan),
    barisPondok: normalizeTextRow(raw.barisPondok, d.barisPondok),
    barisSubUnit: normalizeTextRow(raw.barisSubUnit, d.barisSubUnit),
    barisKontak: normalizeTextRow(raw.barisKontak, d.barisKontak),
    barisRegistrasi: normalizeTextRow(raw.barisRegistrasi, d.barisRegistrasi),
    barisKustom: normalizeTextRow(raw.barisKustom, d.barisKustom),
    logoKiri: normalizeLogo(raw.logoKiri, d.logoKiri),
    logoKanan: normalizeLogo(raw.logoKanan, d.logoKanan),
    garis1: normalizeGaris(raw.garis1, d.garis1),
    garis2: normalizeGaris(raw.garis2, d.garis2),
    padAtas: numOr(raw.padAtas, d.padAtas, 0, 80),
    padBawah: numOr(raw.padBawah, d.padBawah, 0, 80),
    padKiri: numOr(raw.padKiri, d.padKiri, 0, 80),
    padKanan: numOr(raw.padKanan, d.padKanan, 0, 80),
    jarakLogoTeks: numOr(raw.jarakLogoTeks, d.jarakLogoTeks, 5, 60),
    posisiTeks: oneOf(raw.posisiTeks, ['kiri', 'tengah', 'kanan'], d.posisiTeks),
    tinggiHalaman: oneOf(raw.tinggiHalaman, ['kop', 'A4', 'F4'], d.tinggiHalaman),
    background: oneOf(raw.background, ['putih', 'abu', 'custom'], d.background),
    customBg: strOr(raw.customBg, d.customBg),
    radius: numOr(raw.radius, d.radius, 0, 20),
  };
}

/* ============================ DEFAULT ============================ */

const ROW_FONT_ARIAL: KopFont = 'Arial, sans-serif';
const ROW_FONT_TIMES: KopFont = "'Times New Roman', serif";

const DEFAULT_KOP_CONFIG: KopSuratConfig = {
  version: 1,
  namaYayasan: 'YAYASAN AL HIDAYAH TERTEK',
  namaPondok: 'PONDOK PESANTREN AL HIDAYAH TERTEK',
  subUnit: 'Madrasah Diniyah MTs Sabilillah',
  alamat: 'Jln. Mayor Bismo No 71-73 Tertek Pare Kediri',
  telepon: '(0354) 123-456',
  email: 'info@alhidayah.sch.id',
  website: 'www.alhidayah.sch.id',
  kodePos: '64253',

  barisYayasan: {
    visible: true,
    font: ROW_FONT_ARIAL,
    size: 15,
    bold: false,
    italic: false,
    uppercase: true,
    letterSpacing: 0.3,
    lineHeight: 1.2,
    marginBottom: 2,
    color: '#1a1a1a',
    opacity: 100,
    align: 'global',
  },
  barisPondok: {
    visible: true,
    font: ROW_FONT_TIMES,
    size: 23,
    bold: true,
    italic: false,
    uppercase: true,
    letterSpacing: 0,
    lineHeight: 1.2,
    marginBottom: 1,
    color: '#047857',
    opacity: 100,
    align: 'global',
  },
  barisSubUnit: {
    visible: true,
    font: ROW_FONT_ARIAL,
    size: 14,
    bold: false,
    italic: false,
    uppercase: false,
    letterSpacing: 0,
    lineHeight: 1.3,
    marginBottom: 1,
    color: '#333333',
    opacity: 100,
    align: 'global',
  },
  barisKontak: {
    visible: true,
    font: ROW_FONT_ARIAL,
    size: 11,
    bold: false,
    italic: false,
    uppercase: false,
    letterSpacing: 0,
    lineHeight: 1.6,
    marginBottom: 0,
    color: '#555555',
    opacity: 100,
    align: 'global',
  },
  barisRegistrasi: {
    visible: false,
    text: 'Izin Pendirian: SK Kemenkumham No. AHU-0001234 (2020)',
    font: ROW_FONT_ARIAL,
    size: 10,
    bold: false,
    italic: true,
    uppercase: false,
    letterSpacing: 0,
    lineHeight: 1.4,
    marginBottom: 0,
    color: '#555555',
    opacity: 100,
    align: 'global',
  },
  barisKustom: {
    visible: false,
    text: '',
    font: ROW_FONT_ARIAL,
    size: 11,
    bold: false,
    italic: false,
    uppercase: false,
    letterSpacing: 0,
    lineHeight: 1.4,
    marginBottom: 0,
    color: '#333333',
    opacity: 100,
    align: 'global',
  },

  logoKiri: {
    visible: true,
    dataUrl: null,
    size: 80,
    marginX: 10,
    marginTop: 0,
    shape: 'bulat',
    bg: 'putih',
    bgColor: '#ffffff',
  },
  logoKanan: {
    visible: false,
    dataUrl: null,
    size: 80,
    marginX: 10,
    marginTop: 0,
    shape: 'bulat',
    bg: 'putih',
    bgColor: '#ffffff',
  },

  garis1: {
    visible: true,
    jenis: 'double',
    tebal: 3,
    jarakTeks: 10,
    lebar: 100,
    warna: '#1a1a1a',
    jarakGaris: 8,
  },
  garis2: {
    visible: true,
    jenis: 'solid',
    tebal: 1,
    jarakTeks: 0,
    lebar: 100,
    warna: '#1a1a1a',
    jarakGaris: 8,
  },

  padAtas: 20,
  padBawah: 15,
  padKiri: 25,
  padKanan: 25,
  jarakLogoTeks: 20,
  posisiTeks: 'tengah',
  tinggiHalaman: 'A4',
  background: 'putih',
  customBg: '#fafaf5',
  radius: 4,
};

/* ============ PRESET PONDOK ============ */

export type KopPresetKey = 'pondok' | 'madrasah' | 'yayasan';

export function isiPresetPondok(key: KopPresetKey, base?: KopSuratConfig): KopSuratConfig {
  const src: KopSuratConfig = JSON.parse(JSON.stringify(base ?? DEFAULT_KOP_CONFIG));
  if (key === 'madrasah') {
    src.subUnit = 'Madrasah Diniyah & MTs';
    src.garis1.jenis = 'double';
    src.garis1.warna = '#1a1a1a';
    src.barisPondok.color = '#047857';
  } else if (key === 'yayasan') {
    src.namaYayasan = 'YAYASAN PENDIDIKAN ISLAM';
    src.barisYayasan.bold = true;
    src.barisYayasan.color = '#7c2d12';
    src.barisPondok.font = 'Georgia, serif';
    src.barisPondok.color = '#7c2d12';
    src.garis1.jenis = 'solid';
    src.garis1.tebal = 2;
    src.garis1.warna = '#7c2d12';
    src.garis2.visible = false;
  } else {
    src.garis1.jenis = 'double';
    src.garis1.warna = '#1a1a1a';
    src.garis1.tebal = 3;
    src.barisPondok.color = '#047857';
  }
  return src;
}

/** Timpa kolom identitas dari Profil Pondok (nama, alamat, kontak, email, logo) */
export async function isiDariProfilPondok(config: KopSuratConfig): Promise<KopSuratConfig> {
  const profil = await pengaturanService.getProfil();
  const next = { ...config };
  if (profil.nama_pondok) next.namaPondok = profil.nama_pondok.toUpperCase();
  if (profil.alamat) next.alamat = profil.alamat;
  if (profil.kontak) next.telepon = profil.kontak;
  if (profil.email) next.email = profil.email;
  if (profil.logo) {
    next.logoKiri = { ...next.logoKiri, visible: true, dataUrl: profil.logo };
    next.logoKanan = { ...next.logoKanan, dataUrl: null };
  }
  return next;
}

/* ============================ STORAGE ============================ */

export const kopSuratService = {
  /** Ambil seluruh penyimpanan kop (config + gambar). Belum pernah disimpan → null. */
  get(): KopSuratStorage | null {
    try {
      const raw = storage.getItem(KOP_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isObj(parsed)) return null;
      const image = strOr(parsed.image, '');
      return {
        version: 1,
        config: normalizeKopConfig(parsed.config),
        image: image.startsWith('data:image/') ? image : null,
        updatedAt: strOr(parsed.updatedAt, ''),
      };
    } catch {
      return null;
    }
  },

  getConfig(): KopSuratConfig {
    const stored = this.get();
    return stored
      ? stored.config
      : (JSON.parse(JSON.stringify(DEFAULT_KOP_CONFIG)) as KopSuratConfig);
  },

  /** Gambar kop aktif (PNG dataURL) — null bila desain belum pernah diaktifkan */
  getImage(): string | null {
    return this.get()?.image ?? null;
  },

  /** Desain dianggap aktif bila sudah pernah di-render & disimpan dengan gambar */
  isAktif(): boolean {
    return Boolean(this.get()?.image);
  },

  save(config: KopSuratConfig, image: string | null): void {
    const data: KopSuratStorage = {
      version: 1,
      config: { ...config, updatedAt: new Date().toISOString() },
      image,
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(KOP_STORAGE_KEY, JSON.stringify(data));
  },

  getDefault(): KopSuratConfig {
    return JSON.parse(JSON.stringify(DEFAULT_KOP_CONFIG)) as KopSuratConfig;
  },
};
