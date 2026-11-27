import { storage } from './storage';
import { apiRequest } from './apiClient';

type Row = Record<string, any>;

const simpan = (key: string, value: unknown): void => {
  storage.setItem(key, JSON.stringify(value));
};

function sebagaiArray(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function teksJson(value: unknown): any {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function groupMatrix(rows: Row[], field: 'bulan' | 'event'): Record<string, Record<string, Row[]>> {
  const result: Record<string, Record<string, Row[]>> = {};
  for (const row of rows) {
    const santriId = String(row.santri_id);
    const tahun = String(row.tahun);
    result[santriId] ||= {};
    result[santriId][tahun] ||= [];
    result[santriId][tahun].push({
      tahun: Number(row.tahun),
      [field]: field === 'bulan' ? Number(row.bulan) : row.event,
      nominal_tagihan: Number(row.nominal_tagihan),
      total_dibayar: Number(row.total_dibayar),
      status: row.status,
      ...(row.keringanan ? { keringanan: true } : {}),
    });
  }
  return result;
}

function mapTransaksi(row: Row): Row {
  const tambahan = teksJson(row.iuran_tambahan);
  return {
    id: row.id,
    nomor_kuitansi: row.nomor_kuitansi,
    kas_id: row.kas_id,
    santri_id: row.santri_id,
    santri_nama: row.santri_nama,
    santri_nis: row.santri_nis,
    items: teksJson(row.items) || [],
    transaksi_data: {
      tanggal_bayar: row.tanggal_bayar,
      metode: row.metode || 'Tunai',
      ...(row.keterangan ? { keterangan: row.keterangan } : {}),
      ...(tambahan ? { iuran_tambahan: tambahan } : {}),
    },
    total_pembayaran: Number(row.total_pembayaran),
    created_at: row.created_at,
  };
}

function mapKas(row: Row): Row {
  return {
    id: row.id,
    tanggal: row.tanggal,
    jenis: row.jenis,
    kategori_nama: row.kategori_nama,
    nominal: Number(row.nominal),
    ...(row.keterangan ? { keterangan: row.keterangan } : {}),
    ...(row.sumber_modul
      ? { sumber: { modul: row.sumber_modul, ref_id: row.sumber_ref_id } }
      : {}),
    created_at: row.created_at,
  };
}

/**
 * Tarik data dari API lalu tulis ke key storage yang sama seperti mode lokal.
 * Dengan begitu semua service pembaca (laporan, dashboard, kop surat, dll.)
 * tetap bekerja tanpa diubah—hanya jalur tulis yang dibelokkan ke API.
 */
export async function syncFromApi(): Promise<void> {
  const response = await apiRequest<{ data: Record<string, unknown> }>('/api/backup');
  const d = response.data;
  const users = sebagaiArray(d.users);
  const userName = new Map(users.map((u) => [String(u.id), String(u.username)]));

  const periods = sebagaiArray(d.santri_periode_nonaktif);
  simpan(
    'al_hidayah_santri',
    sebagaiArray(d.santri).map((row) => ({
      ...row,
      periode_nonaktif: periods
        .filter((p) => p.santri_id === row.id)
        .map((p) => ({ mulai: p.mulai, ...(p.sampai ? { sampai: p.sampai } : {}) })),
    }))
  );

  simpan('al_hidayah_syahriyah', groupMatrix(sebagaiArray(d.syahriyah_bulan), 'bulan'));
  simpan(
    'al_hidayah_syahriyah_waivers',
    sebagaiArray(d.keringanan_syahriyah).map((row) => ({
      id: row.id,
      santri_id: row.santri_id,
      tahun: Number(row.tahun),
      bulan_mulai: Number(row.bulan_mulai),
      bulan_selesai: Number(row.bulan_selesai),
      nominal_per_bulan: Number(row.nominal_per_bulan),
      jenis: row.jenis || 'kustom',
      ...(row.keterangan ? { keterangan: row.keterangan } : {}),
      snapshot: teksJson(row.snapshot) || {},
      created_at: row.created_at,
    }))
  );
  simpan('al_hidayah_kilatan', groupMatrix(sebagaiArray(d.kilatan_bulan), 'event'));
  simpan('al_hidayah_syahriyah_transaksi', sebagaiArray(d.transaksi_syahriyah).map(mapTransaksi));
  simpan('al_hidayah_kilatan_transaksi', sebagaiArray(d.transaksi_kilatan).map(mapTransaksi));
  simpan('al_hidayah_iuran_pembayaran', sebagaiArray(d.iuran_pembayaran));
  simpan('al_hidayah_iuran_tambahan', sebagaiArray(d.iuran_tambahan));
  simpan('al_hidayah_kas', sebagaiArray(d.buku_kas).map(mapKas));

  const kategori: Record<string, string[]> = { pemasukan: [], pengeluaran: [] };
  for (const row of sebagaiArray(d.kategori_kas)) {
    (kategori[String(row.jenis)] ||= []).push(String(row.nama));
  }
  simpan('al_hidayah_kategori_kas', kategori);

  simpan('al_hidayah_pendaftaran', sebagaiArray(d.pendaftaran));
  simpan('al_hidayah_master_iuran', sebagaiArray(d.master_iuran));
  simpan('al_hidayah_arsip_tarif', sebagaiArray(d.arsip_tarif));
  simpan('al_hidayah_users', users);

  const counter: Record<string, number> = {};
  for (const row of sebagaiArray(d.kuitansi_counter)) counter[String(row.tahun)] = Number(row.nilai_counter);
  simpan('al_hidayah_nomor_kuitansi', counter);

  for (const row of sebagaiArray(d.pengaturan)) {
    const keyMap: Record<string, string> = {
      profil: 'al_hidayah_profil',
      tarif: 'al_hidayah_tarif',
      kop_surat: 'al_hidayah_kop_surat',
      kwitansi_config: 'al_hidayah_kwitansi_config',
    };
    const key = keyMap[String(row.kunci)];
    if (key) simpan(key, teksJson(row.nilai));
  }

  const printLogs: Record<string, Row[]> = {};
  for (const row of sebagaiArray(d.print_log)) {
    (printLogs[String(row.transaksi_id)] ||= []).push({
      id: row.id,
      transaksi_id: row.transaksi_id,
      type: row.type,
      printed_at: row.printed_at,
      printed_by: userName.get(String(row.printed_by)) || row.printed_by,
    });
  }
  simpan('al_hidayah_print_logs', printLogs);

  simpan(
    'al_hidayah_activity_log',
    sebagaiArray(d.activity_log).map((row) => ({
      id: row.id,
      waktu: row.waktu,
      modul: row.modul,
      aksi: row.aksi,
      deskripsi: row.deskripsi,
      ...(row.ref_id ? { ref_id: row.ref_id } : {}),
      ...(row.user_id ? { user: userName.get(String(row.user_id)) } : {}),
    }))
  );
}
