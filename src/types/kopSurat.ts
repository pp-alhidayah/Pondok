/**
 * Types untuk fitur Desain Kop Surat.
 *
 * Desain dipakai untuk menghasilkan gambar kop yang ditumpuk pada PDF
 * laporan / rekap pembukuan (lihat lib/kopSuratService.ts dan pdfHelper.ts).
 */

export type KopFont =
  | 'Arial, sans-serif'
  | "'Times New Roman', serif"
  | 'Georgia, serif'
  | 'Verdana, sans-serif'
  | "'Segoe UI', sans-serif"
  | 'Helvetica, sans-serif'
  | 'Calibri, sans-serif'
  | "'Trebuchet MS', sans-serif"
  | 'Impact, sans-serif';

export type KopAlign = 'global' | 'left' | 'center' | 'right';

export interface KopTextRow {
  /** Baris tampil / disembunyikan */
  visible: boolean;
  /** Isi baris. Baris yayasan/pondok/subunit diambil dari kolom info instansi,
   *  baris kontak digenerate otomatis — jadi field ini hanya dipakai untuk
   *  baris registrasi & kustom. */
  text?: string;
  font: KopFont;
  size: number; // 8 - 48
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  letterSpacing: number; // px, -2 s/d 12
  lineHeight: number; // 0.8 - 3
  marginBottom: number; // px, 0 - 20
  color: string;
  opacity: number; // 30 - 100 (persen)
  align: KopAlign;
}

export type KopLogoShape = 'asli' | 'bulat' | 'membulat';
export type KopLogoBg = 'transparan' | 'putih' | 'warna';

export interface KopLogoConfig {
  visible: boolean;
  /** DataURL gambar logo */
  dataUrl: string | null;
  size: number; // px, 30 - 200
  marginX: number; // margin sisi luar logo (kiri utk logo kiri, kanan utk kanan)
  marginTop: number; // 0 - 60
  shape: KopLogoShape;
  bg: KopLogoBg;
  bgColor: string;
}

export type KopLineJenis = 'solid' | 'double' | 'dashed' | 'dotted';

export interface KopLineConfig {
  visible: boolean;
  jenis: KopLineJenis;
  tebal: number; // 1 - 12 px
  jarakTeks: number; // 0 - 40 px (jarak dari baris teks terakhir)
  lebar: number; // 10 - 100 (%) lebar konten
  warna: string;
  /** Hanya dipakai oleh garis 2: jarak dari garis 1 */
  jarakGaris: number; // 1 - 20 px
}

export type KopPosisiTeks = 'kiri' | 'tengah' | 'kanan';
export type KopTinggiHalaman = 'kop' | 'A4' | 'F4';
export type KopBackground = 'putih' | 'abu' | 'custom';

export interface KopSuratConfig {
  version: number;

  // Informasi kop
  namaYayasan: string;
  namaPondok: string;
  subUnit: string;
  alamat: string;
  telepon: string;
  email: string;
  website: string;
  kodePos: string;

  // Tipografi per baris
  barisYayasan: KopTextRow;
  barisPondok: KopTextRow;
  barisSubUnit: KopTextRow;
  barisKontak: KopTextRow;
  barisRegistrasi: KopTextRow;
  barisKustom: KopTextRow;

  // Logo kiri & kanan
  logoKiri: KopLogoConfig;
  logoKanan: KopLogoConfig;

  // Garis horizontal
  garis1: KopLineConfig;
  garis2: KopLineConfig;

  // Layout kertas
  padAtas: number; // 0 - 80
  padBawah: number;
  padKiri: number;
  padKanan: number;
  jarakLogoTeks: number; // 5 - 60
  posisiTeks: KopPosisiTeks;
  tinggiHalaman: KopTinggiHalaman;
  background: KopBackground;
  customBg: string;
  radius: number; // 0 - 20

  updatedAt?: string;
}

/** Envelope penyimpanan: config + gambar siap pakai untuk PDF */
export interface KopSuratStorage {
  version: number;
  config: KopSuratConfig;
  /** PNG dataURL hasil render preview — null berarti belum digenerate */
  image: string | null;
  updatedAt: string;
}

export const KOP_STORAGE_KEY = 'al_hidayah_kop_surat';
