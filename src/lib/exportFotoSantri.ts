import * as XLSX from 'xlsx';
import { Santri } from '../types/santri';
import { showToast } from '../components/ui/Toast';
import { sanitizeSpreadsheetCell } from './core';
import { isValidFotoDataUrl } from './fotoSantri';
import { buildZip, ZipEntry } from './zipHelper';

const EKSTENSI_FOTO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function ekstensiFoto(dataUrl: string): string {
  const mime = /^data:image\/([a-z+]+);/i.exec(dataUrl)?.[1]?.toLowerCase() || 'jpeg';
  return EKSTENSI_FOTO[`image/${mime}`] || 'jpg';
}

function bytesDariDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const biner = atob(base64);
  const bytes = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i += 1) bytes[i] = biner.charCodeAt(i);
  return bytes;
}

function namaAman(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 60) || 'santri'
  );
}

/**
 * Unduh satu berkas ZIP berisi:
 * - `<nama>.xlsx` : data santri (termasuk kolom "File Foto"),
 * - `foto/`       : berkas foto per santri bernama `NIS_Nama.ext`,
 * - `PETUNJUK.txt`.
 *
 * Foto disimpan aplikasi sebagai data URL, jadi tidak bisa disematkan langsung
 * ke Excel oleh SheetJS Community Edition. Memisahkannya ke folder foto
 * membuat hasil ekspor tetap bisa dibuka di Excel dan fotonya tidak hilang.
 */
export async function exportFotoDanDataSantri(
  santriList: Santri[],
  filenameBase: string
): Promise<void> {
  if (!santriList.length) {
    showToast('Tidak ada data santri untuk diekspor', 'error');
    return;
  }

  try {
    const entries: ZipEntry[] = [];
    const pathFoto = new Map<string, string>();
    const namaDipakai = new Set<string>();
    let jumlahFoto = 0;

    for (const santri of santriList) {
      const foto = santri.foto;
      let path = '';

      if (foto && isValidFotoDataUrl(foto)) {
        const ext = ekstensiFoto(foto);
        const dasar = `${namaAman(santri.nis || 'tanpa-nis')}_${namaAman(santri.nama)}`;
        let namaFile = `${dasar}.${ext}`;
        let urutan = 2;
        while (namaDipakai.has(namaFile.toLowerCase())) {
          namaFile = `${dasar}_${urutan}.${ext}`;
          urutan += 1;
        }
        namaDipakai.add(namaFile.toLowerCase());
        path = `foto/${namaFile}`;

        entries.push({ name: path, data: bytesDariDataUrl(foto) });
        jumlahFoto += 1;
      }

      pathFoto.set(santri.id, path);
    }

    const baris = santriList.map((s) => ({
      NIS: sanitizeSpreadsheetCell(s.nis),
      'Nama Santri': sanitizeSpreadsheetCell(s.nama),
      Kategori: sanitizeSpreadsheetCell(s.kategori),
      Status: sanitizeSpreadsheetCell(s.status),
      'Nama Wali': sanitizeSpreadsheetCell(s.nama_wali || ''),
      'No HP Santri': sanitizeSpreadsheetCell(s.no_hp_santri || ''),
      'No HP Wali': sanitizeSpreadsheetCell(s.no_hp_wali || ''),
      'Tanggal Masuk': sanitizeSpreadsheetCell(s.tanggal_masuk || '-'),
      Catatan: sanitizeSpreadsheetCell(s.catatan || ''),
      'File Foto': pathFoto.get(s.id) || '',
    }));

    const ws = XLSX.utils.json_to_sheet(baris);
    ws['!cols'] = [
      { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 22 },
      { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 34 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Santri');
    const xlsxBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;

    entries.unshift({
      name: `${filenameBase}.xlsx`,
      data: new Uint8Array(xlsxBytes),
    });

    const petunjuk = [
      'EKSPOR DATA SANTRI + FOTO',
      '=========================',
      '',
      `${filenameBase}.xlsx — data santri lengkap`,
      `foto/ — ${jumlahFoto} berkas foto santri`,
      '',
      'Kolom "File Foto" pada Excel berisi path relatif ke berkas di folder foto/.',
      'Nama berkas foto: NIS_Nama.ext (karakter tidak aman diganti underscore).',
      'Santri tanpa foto tidak memiliki berkas di folder foto/.',
      '',
      `Diekspor: ${new Date().toLocaleString('id-ID')}`,
    ].join('\r\n');

    entries.push({
      name: 'PETUNJUK.txt',
      data: new TextEncoder().encode(petunjuk),
    });

    const zip = buildZip(entries);
    // buildZip mengalokasikan buffer baru persis seukuran isi, aman dipakai langsung.
    const url = URL.createObjectURL(
      new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' })
    );
    const taut = document.createElement('a');
    taut.href = url;
    taut.download = `${filenameBase}-Foto.zip`;
    document.body.appendChild(taut);
    taut.click();
    taut.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast(
      `Ekspor selesai: ${santriList.length} data santri, ${jumlahFoto} foto`,
      'success'
    );
  } catch {
    showToast('Gagal mengekspor foto dan data santri', 'error');
  }
}
