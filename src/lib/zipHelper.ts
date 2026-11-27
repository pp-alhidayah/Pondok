/**
 * Penulis ZIP minimal tanpa dependency tambahan.
 *
 * Memakai metode STORE (tanpa kompresi) karena foto sudah terkompresi (JPEG)
 * dan berkas .xlsx sendiri sudah berupa ZIP. Cukup untuk paket ekspor
 * "data + foto" yang diunduh lewat browser.
 */

export interface ZipEntry {
  /** Path relatif di dalam ZIP, mis. "foto/2026001_Ahmad.jpg". */
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC32 (IEEE) — diverifikasi dengan vektor "123456789" → 0xCBF43926. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function gabungkan(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, part) => n + part.length, 0);
  const hasil = new Uint8Array(total);
  let posisi = 0;
  for (const part of parts) {
    hasil.set(part, posisi);
    posisi += part.length;
  }
  return hasil;
}

/** Bangun arsip ZIP (STORE) dari daftar berkas. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const lokal: Uint8Array[] = [];
  const sentral: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nama = encoder.encode(entry.name);
    const checksum = crc32(entry.data);

    const headerLokal = new Uint8Array(30 + nama.length);
    const lv = new DataView(headerLokal.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // versi minimal
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true); // jam
    lv.setUint16(12, 0x0021, true); // tanggal 1980-01-01
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, entry.data.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, nama.length, true);
    lv.setUint16(28, 0, true);
    headerLokal.set(nama, 30);

    lokal.push(headerLokal, entry.data);

    const headerSentral = new Uint8Array(46 + nama.length);
    const cv = new DataView(headerSentral.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // versi pembuat
    cv.setUint16(6, 20, true); // versi minimal
    cv.setUint16(8, 0x0800, true); // UTF-8
    cv.setUint16(10, 0, true); // STORE
    cv.setUint16(12, 0, true); // jam
    cv.setUint16(14, 0x0021, true); // tanggal
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nama.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // komentar
    cv.setUint16(34, 0, true); // disk awal
    cv.setUint16(36, 0, true); // atribut internal
    cv.setUint32(38, 0, true); // atribut eksternal
    cv.setUint32(42, offset, true); // offset header lokal
    headerSentral.set(nama, 46);

    sentral.push(headerSentral);
    offset += headerLokal.length + entry.data.length;
  }

  const ukuranSentral = sentral.reduce((n, part) => n + part.length, 0);
  const akhir = new Uint8Array(22);
  const ev = new DataView(akhir.buffer);
  ev.setUint32(0, 0x06054b50, true); // signature EOCD
  ev.setUint16(4, 0, true); // nomor disk
  ev.setUint16(6, 0, true); // disk berisi direktori sentral
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, ukuranSentral, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true); // panjang komentar

  return gabungkan([...lokal, ...sentral, akhir]);
}
