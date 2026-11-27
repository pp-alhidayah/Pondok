import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import { syahriyahService } from '../src/lib/syahriyahService';
import { kilatanService } from '../src/lib/kilatanService';
import { iuranPembayaranService } from '../src/lib/iuranPembayaranService';
import { KAS_STORAGE_KEY } from '../src/lib/kasService';
import type { Kas } from '../src/types/kas';
import type { SyahriyahTransaksiRecord } from '../src/types/syahriyah';
import type { KilatanTransaksiRecord } from '../src/types/kilatan';
import type { IuranPembayaran } from '../src/types/iuranPembayaran';

const KEY_SYAHRIYAH = 'al_hidayah_syahriyah';
const KEY_SYAHRIYAH_TRX = 'al_hidayah_syahriyah_transaksi';
const KEY_KILATAN = 'al_hidayah_kilatan';
const KEY_KILATAN_TRX = 'al_hidayah_kilatan_transaksi';

const TRX_RECORD: SyahriyahTransaksiRecord = {
  id: 'trx-1',
  nomor_kuitansi: 'AH/2026/001',
  kas_id: 'kas-1',
  santri_id: 's1',
  santri_nama: 'Ahmad Fauzi',
  santri_nis: '2026.001',
  items: [
    { tahun: 2026, bulan: 1, nominal: 300000, jenis: 'Penuh' },
    { tahun: 2026, bulan: 2, nominal: 150000, jenis: 'Sebagian' },
  ],
  transaksi_data: {
    tanggal_bayar: '2026-01-10',
    metode: 'Tunai',
  },
  total_pembayaran: 450000,
  created_at: '2026-01-10T00:00:00.000Z',
};

const KAS_RECORD: Kas = {
  id: 'kas-1',
  tanggal: '2026-01-10',
  jenis: 'Pemasukan',
  kategori_nama: 'Syahriyah',
  nominal: 450000,
  sumber: { modul: 'syahriyah', ref_id: 'trx-1' },
  created_at: '2026-01-10T00:00:00.000Z',
};

function seedSyahriyah(): void {
  // Matriks: Jan Lunas penuh, Feb Sebagian (150rb dari 300rb)
  localStorage.setItem(
    KEY_SYAHRIYAH,
    JSON.stringify({
      s1: {
        2026: [
          {
            tahun: 2026,
            bulan: 1,
            nominal_tagihan: 300000,
            total_dibayar: 300000,
            status: 'Lunas',
          },
          {
            tahun: 2026,
            bulan: 2,
            nominal_tagihan: 300000,
            total_dibayar: 150000,
            status: 'Sebagian',
          },
        ],
      },
    })
  );
  localStorage.setItem(KEY_SYAHRIYAH_TRX, JSON.stringify([TRX_RECORD]));
  localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify([KAS_RECORD]));
}

beforeEach(() => {
  installLocalStorage();
  // Nomor kuitansi sudah maju (kuitansi 001 sudah terpakai)
  localStorage.setItem('al_hidayah_nomor_kuitansi', '1');
});

/** Entri kas terkait transaksi. */
function kasUntuk(id: string, nominal: number): Kas {
  return {
    id: `kas-${id}`,
    tanggal: '2026-01-10',
    jenis: 'Pemasukan',
    kategori_nama: 'Syahriyah',
    nominal,
    sumber: { modul: 'syahriyah', ref_id: id },
    created_at: '2026-01-10T00:00:00.000Z',
  };
}

test('batalkanPembayaran (syahriyah): matriks berkurang, transaksi & kas hilang, status dihitung ulang', async () => {
  seedSyahriyah();

  await syahriyahService.batalkanPembayaran('trx-1');

  // Matriks
  const matrix = JSON.parse(localStorage.getItem(KEY_SYAHRIYAH) || '{}');
  const rows = matrix.s1['2026'];
  assert.equal(rows[0].total_dibayar, 0);
  assert.equal(rows[0].status, 'Belum');
  assert.equal(rows[1].total_dibayar, 0, 'cicilan sebagian ikut dikurangkan');
  assert.equal(rows[1].status, 'Belum');

  // Transaksi dihapus
  assert.deepEqual(
    JSON.parse(localStorage.getItem(KEY_SYAHRIYAH_TRX) || '[]'),
    []
  );

  // Kas dihapus
  assert.deepEqual(
    JSON.parse(localStorage.getItem(KAS_STORAGE_KEY) || '[]'),
    []
  );

  // Nomor kuitansi tidak dipakai ulang (counter tetap di 1)
  assert.equal(localStorage.getItem('al_hidayah_nomor_kuitansi'), '1');
});

test('batalkanPembayaran (syahriyah): pembatalan sebagian membuat status Sebagian tersisa', async () => {
  // Hanya batalkan item Jan (via transaksi yang hanya memuat Jan, kas sama)
  seedSyahriyah();
  const partial = {
    ...TRX_RECORD,
    id: 'trx-2',
    items: [{ tahun: 2026, bulan: 2, nominal: 150000, jenis: 'Sebagian' }],
    transaksi_data: { tanggal_bayar: '2026-01-11', metode: 'Tunai' },
    total_pembayaran: 150000,
  };
  localStorage.setItem(
    KEY_SYAHRIYAH_TRX,
    JSON.stringify([
      // trx-1 dianggap sudah dibatalkan sebelumnya: hanya tersisa partial
      partial,
    ])
  );
  localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify([kasUntuk('trx-2', 150000)]));

  await syahriyahService.batalkanPembayaran('trx-2');

  const matrix = JSON.parse(localStorage.getItem(KEY_SYAHRIYAH) || '{}');
  const rows = matrix.s1['2026'];
  assert.equal(rows[0].total_dibayar, 300000, 'Jan tetap Lunas (manual)');
  assert.equal(rows[1].total_dibayar, 0);
  assert.equal(rows[1].status, 'Belum');
});

test('batalkanPembayaran (syahriyah): tolak record yang sudah tidak ada', async () => {
  seedSyahriyah();

  await assert.rejects(
    syahriyahService.batalkanPembayaran('trx-tidak-ada'),
    /tidak ditemukan/
  );
});

test('batalkanPembayaran (syahriyah): entri kas hilang → rollback penuh (atomik)', async () => {
  seedSyahriyah();
  // Kas hilang (mis. sudah dihapus manual) → pembatalan harus gagal tanpa efek sisa
  localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify([]));

  await assert.rejects(
    syahriyahService.batalkanPembayaran('trx-1'),
    /kas/i
  );

  // Matriks dan transaksi kembali seperti semula
  const matrix = JSON.parse(localStorage.getItem(KEY_SYAHRIYAH) || '{}');
  const rows = matrix.s1['2026'];
  assert.equal(rows[0].total_dibayar, 300000);
  assert.equal(rows[0].status, 'Lunas');
  assert.equal(rows[1].total_dibayar, 150000);
  assert.equal(rows[1].status, 'Sebagian');

  const trx = JSON.parse(localStorage.getItem(KEY_SYAHRIYAH_TRX) || '[]');
  assert.equal(trx.length, 1);
  assert.equal(trx[0].id, 'trx-1');
});

/** Kilatan: satu item event per baris matriks. */
function seedKilatan(): void {
  localStorage.setItem(
    KEY_KILATAN,
    JSON.stringify({
      s1: {
        2026: [
          {
            tahun: 2026,
            event: 'Romadhon',
            nominal_tagihan: 150000,
            total_dibayar: 150000,
            status: 'Lunas',
          },
          {
            tahun: 2026,
            event: 'Maulid',
            nominal_tagihan: 100000,
            total_dibayar: 50000,
            status: 'Sebagian',
          },
        ],
      },
    })
  );
  const record: KilatanTransaksiRecord = {
    id: 'kil-1',
    nomor_kuitansi: 'AH/2026/002',
    kas_id: 'kas-2',
    santri_id: 's1',
    santri_nama: 'Ahmad Fauzi',
    santri_nis: '2026.001',
    items: [
      { tahun: 2026, event: 'Romadhon', nominal: 150000, jenis: 'Penuh' },
      { tahun: 2026, event: 'Maulid', nominal: 50000, jenis: 'Sebagian' },
    ],
    transaksi_data: {
      tanggal_bayar: '2026-02-10',
      metode: 'Transfer',
    },
    total_pembayaran: 200000,
    created_at: '2026-02-10T00:00:00.000Z',
  };
  localStorage.setItem(KEY_KILATAN_TRX, JSON.stringify([record]));
  localStorage.setItem(
    KAS_STORAGE_KEY,
    JSON.stringify([
      { ...KAS_RECORD, id: 'kas-2', sumber: { modul: 'kilatan', ref_id: 'kil-1' } },
    ])
  );
}

test('batalkanPembayaran (kilatan): matriks berkurang, transaksi & kas hilang', async () => {
  seedKilatan();

  await kilatanService.batalkanPembayaran('kil-1');

  const matrix = JSON.parse(localStorage.getItem(KEY_KILATAN) || '{}');
  const rows = matrix.s1['2026'];
  assert.equal(rows[0].total_dibayar, 0);
  assert.equal(rows[0].status, 'Belum');
  assert.equal(rows[1].total_dibayar, 0);
  assert.equal(rows[1].status, 'Belum');

  assert.deepEqual(JSON.parse(localStorage.getItem(KEY_KILATAN_TRX) || '[]'), []);
  assert.deepEqual(JSON.parse(localStorage.getItem(KAS_STORAGE_KEY) || '[]'), []);
});

test('batalkanPembayaran (kilatan): tolak record yang sudah tidak ada', async () => {
  seedKilatan();

  await assert.rejects(
    kilatanService.batalkanPembayaran('kil-tidak-ada'),
    /tidak ditemukan/
  );
});

/** Iuran: pembayaran mandiri (bukan matriks santri). */
const KEY_IURAN = 'al_hidayah_iuran_pembayaran';

function iuranRecord(id: string, nominal: number): IuranPembayaran {
  return {
    id,
    iuran_id: 'mst-1',
    iuran_nama: 'Seragam',
    tipe_pembayar: 'santri',
    santri_id: 's1',
    nama_pembayar: 'Ahmad Fauzi',
    periode_bulan: '2026-01',
    periode_tahun: 2026,
    nominal,
    tanggal_bayar: '2026-01-15',
    metode: 'Tunai',
    kas_id: `kas-${id}`,
    created_at: '2026-01-15T00:00:00.000Z',
  };
}

function seedIuran(): void {
  const records = [iuranRecord('iur-1', 50000), iuranRecord('iur-2', 35000)];
  localStorage.setItem(KEY_IURAN, JSON.stringify(records));
  localStorage.setItem(
    KAS_STORAGE_KEY,
    JSON.stringify([
      { ...KAS_RECORD, id: 'kas-iur-1', nominal: 50000, kategori_nama: 'Iuran', sumber: { modul: 'iuran', ref_id: 'iur-1' } },
      { ...KAS_RECORD, id: 'kas-iur-2', nominal: 35000, kategori_nama: 'Iuran', sumber: { modul: 'iuran', ref_id: 'iur-2' } },
    ])
  );
}

test('batalkanPembayaran (iuran): record & kas terkait hilang, transaksi lain tetap', async () => {
  seedIuran();

  await iuranPembayaranService.batalkanPembayaran('iur-1');

  const sisa = JSON.parse(localStorage.getItem(KEY_IURAN) || '[]');
  assert.equal(sisa.length, 1);
  assert.equal(sisa[0].id, 'iur-2');

  const kas = JSON.parse(localStorage.getItem(KAS_STORAGE_KEY) || '[]');
  assert.equal(kas.length, 1);
  assert.equal(kas[0].id, 'kas-iur-2');
});

test('batalkanPembayaran (iuran): tolak record yang sudah tidak ada', async () => {
  seedIuran();

  await assert.rejects(
    iuranPembayaranService.batalkanPembayaran('iur-tidak-ada'),
    /tidak ditemukan/
  );

  // Tidak ada perubahan saat record tidak ditemukan
  assert.equal(JSON.parse(localStorage.getItem(KEY_IURAN) || '[]').length, 2);
});

test('batalkanPembayaran (iuran): entri kas hilang → rollback penuh (atomik)', async () => {
  seedIuran();
  // Hapus kas milik iur-1 saja → pembatalan harus gagal tanpa menghapus record
  const kas = JSON.parse(localStorage.getItem(KAS_STORAGE_KEY) || '[]');
  localStorage.setItem(
    KAS_STORAGE_KEY,
    JSON.stringify(kas.filter((k: Kas) => k.id !== 'kas-iur-1'))
  );

  await assert.rejects(
    iuranPembayaranService.batalkanPembayaran('iur-1'),
    /kas/i
  );

  const records = JSON.parse(localStorage.getItem(KEY_IURAN) || '[]');
  assert.equal(records.length, 2, 'record iuran tidak boleh terhapus sebagian');
  assert.ok(records.some((r: IuranPembayaran) => r.id === 'iur-1'));
});
