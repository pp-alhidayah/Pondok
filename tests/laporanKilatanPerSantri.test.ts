import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import { laporanService } from '../src/lib/laporanService';

const TAHUN = 2026;

const santri = (id: string, nis: string, nama: string, kategori: string) => ({
  id,
  nis,
  nama,
  nama_wali: 'Wali',
  no_hp_santri: '081234567890',
  no_hp_wali: '081234567891',
  kategori,
  status: 'Aktif',
  tanggal_masuk: `${TAHUN}-01-01`,
  created_at: '',
  updated_at: '',
});

const event = (nama: string, tagihan: number, dibayar: number) => ({
  tahun: TAHUN,
  event: nama as any,
  nominal_tagihan: tagihan,
  total_dibayar: dibayar,
  status: 'Belum' as const,
});

beforeEach(() => {
  installLocalStorage();
});

test('getRekapKilatanPerSantri menyusun NIS + kolom semua event + total bayar', async () => {
  const storage = installLocalStorage();
  storage.setItem(
    'al_hidayah_santri',
    JSON.stringify([
      santri('s1', '2026001', 'Ahmad', 'Mukim'),
      santri('s2', '2026002', 'Budi', 'Nduduk'),
      santri('s3', '2026003', 'Tidak Ikut', 'Mukim'),
    ])
  );

  storage.setItem(
    'al_hidayah_kilatan',
    JSON.stringify({
      s1: {
        [TAHUN]: [
          event('Romadhon', 100000, 100000),
          event('Dzulhijjah', 100000, 0),
          event('Maulid', 100000, 40000),
          event('Jumadil Ula', 100000, 0),
        ],
      },
      s2: {
        [TAHUN]: [event('Romadhon', 100000, 20000), event('Dzulhijjah', 100000, 100000)],
      },
      // Tidak punya pembayaran sama sekali → tidak masuk rekap.
      s3: { [TAHUN]: [event('Romadhon', 100000, 0)] },
    })
  );

  const rows = await laporanService.getRekapKilatanPerSantri(TAHUN);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    santriId: 's1',
    nis: '2026001',
    nama: 'Ahmad',
    kategori: 'Mukim',
    events: {
      'Jumadil Ula': 0,
      Maulid: 40000,
      Romadhon: 100000,
      Dzulhijjah: 0,
    },
    totalDibayar: 140000,
  });
  assert.equal(rows[1].nama, 'Budi');
  assert.equal(rows[1].events.Romadhon, 20000);
  assert.equal(rows[1].events.Dzulhijjah, 100000);
  assert.equal(rows[1].totalDibayar, 120000);
  assert.ok(rows.every((r) => r.santriId !== 's3'));
});

test('getRekapKilatanPerSantri mengembalikan array kosong bila belum ada pembayaran', async () => {
  const storage = installLocalStorage();
  storage.setItem('al_hidayah_santri', JSON.stringify([santri('s1', '2026001', 'Ahmad', 'Mukim')]));
  storage.setItem(
    'al_hidayah_kilatan',
    JSON.stringify({ s1: { [TAHUN]: [event('Romadhon', 100000, 0)] } })
  );

  assert.deepEqual(await laporanService.getRekapKilatanPerSantri(TAHUN), []);
});
