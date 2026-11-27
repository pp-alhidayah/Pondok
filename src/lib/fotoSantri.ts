import { storage } from './storage';
/**
 * Utilitas foto santri.
 *
 * Foto disimpan sebagai data URL di field `santri.foto` (storage / kolom TEXT DB).
 * Karena itu gambar dikompresi ke maksimal 320px dan ±48 KB base64 supaya:
 * - tidak menabrak kuota storage di mode lokal,
 * - tidak melebihi batas kolom `foto TEXT` (~65 KB) di mode API.
 */

export const FOTO_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB file mentah
export const FOTO_MAX_OUTPUT_CHARS = 48_000; // base64 hasil kompresi
const FOTO_MAX_DIMENSION = 320;

const bacaSebagaiDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file foto'));
    reader.readAsDataURL(file);
  });

const kompresDataUrl = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const skala = Math.min(1, FOTO_MAX_DIMENSION / Math.max(img.width, img.height));
      const lebar = Math.max(1, Math.round(img.width * skala));
      const tinggi = Math.max(1, Math.round(img.height * skala));

      const canvas = document.createElement('canvas');
      canvas.width = lebar;
      canvas.height = tinggi;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Browser tidak mendukung pengolahan gambar'));
        return;
      }

      // Latar putih agar PNG transparan tidak hitam setelah jadi JPEG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, lebar, tinggi);
      ctx.drawImage(img, 0, 0, lebar, tinggi);

      let hasil = canvas.toDataURL('image/jpeg', 0.75);
      for (const kualitas of [0.65, 0.55, 0.45, 0.35]) {
        if (hasil.length <= FOTO_MAX_OUTPUT_CHARS) break;
        hasil = canvas.toDataURL('image/jpeg', kualitas);
      }
      resolve(hasil);
    };
    img.onerror = () => reject(new Error('File gambar tidak dapat dibuka'));
    img.src = src;
  });

/** Validasi, baca, lalu kompres foto menjadi data URL JPEG yang siap disimpan. */
export async function kompresFotoSantri(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Harap pilih file gambar (JPG, PNG, atau WebP)');
  }
  if (file.size > FOTO_MAX_FILE_BYTES) {
    throw new Error('Ukuran foto maksimal 5 MB');
  }
  const dataUrl = await bacaSebagaiDataUrl(file);
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('File bukan gambar yang valid');
  }
  return kompresDataUrl(dataUrl);
}

/** Cek apakah data URL foto masih valid (dipakai UI saat fallback ke inisial). */
export const isValidFotoDataUrl = (foto?: string | null): boolean =>
  Boolean(foto && /^data:image\/[a-z+]+;base64,/i.test(foto));
