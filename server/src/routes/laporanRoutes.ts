import { Router } from 'express';
import { requireAuth } from '../auth';
import { query, type Rows } from '../db';
import { asyncHandler, badRequest } from '../errors';

type Jenis = 'keuangan' | 'santri' | 'pendaftaran' | 'syahriyah' | 'iuran' | 'kilatan';
const JENIS: Jenis[] = ['keuangan', 'santri', 'pendaftaran', 'syahriyah', 'iuran', 'kilatan'];

export const laporanRoutes = Router();

laporanRoutes.get('/:jenis', requireAuth, asyncHandler(async (req, res) => {
  const jenis = req.params.jenis as Jenis;
  if (!JENIS.includes(jenis)) throw badRequest('Jenis laporan tidak dikenal');
  const tahun = Number(req.query.tahun) || new Date().getFullYear();
  let data: Rows;
  let summary: Record<string, number> = {};

  switch (jenis) {
    case 'keuangan':
      data = await query<Rows>(
        `SELECT MONTH(tanggal) AS bulan, jenis, SUM(nominal) AS total
         FROM buku_kas WHERE YEAR(tanggal) = ? GROUP BY MONTH(tanggal), jenis ORDER BY bulan`,
        [tahun]
      );
      break;
    case 'santri':
      data = await query<Rows>(
        `SELECT kategori, status, COUNT(*) AS jumlah FROM santri GROUP BY kategori, status ORDER BY kategori`
      );
      break;
    case 'pendaftaran':
      data = await query<Rows>(
        `SELECT status, COUNT(*) AS jumlah FROM pendaftaran WHERE YEAR(created_at) = ? GROUP BY status`,
        [tahun]
      );
      break;
    case 'syahriyah':
      data = await query<Rows>(
        `SELECT s.id, s.nis, s.nama, SUM(m.nominal_tagihan) AS tagihan,
                SUM(m.total_dibayar) AS dibayar, SUM(m.nominal_tagihan) - SUM(m.total_dibayar) AS sisa
         FROM santri s LEFT JOIN syahriyah_bulan m ON m.santri_id = s.id AND m.tahun = ?
         GROUP BY s.id ORDER BY s.nama`,
        [tahun]
      );
      break;
    case 'iuran':
      data = await query<Rows>(
        `SELECT m.id, m.nama, SUM(p.nominal) AS dibayar, COUNT(p.id) AS transaksi
         FROM master_iuran m LEFT JOIN iuran_pembayaran p ON p.iuran_id = m.id AND YEAR(p.tanggal_bayar) = ?
         GROUP BY m.id ORDER BY m.nama`,
        [tahun]
      );
      break;
    case 'kilatan':
      data = await query<Rows>(
        `SELECT event, SUM(nominal_tagihan) AS tagihan, SUM(total_dibayar) AS dibayar,
                SUM(nominal_tagihan) - SUM(total_dibayar) AS sisa
         FROM kilatan_bulan WHERE tahun = ? GROUP BY event ORDER BY event`,
        [tahun]
      );
      break;
  }

  const angka = (rows: Rows, field: string) =>
    rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
  summary = {
    total_tagihan: angka(data, 'tagihan'),
    total_dibayar: angka(data, 'dibayar'),
    total_sisa: angka(data, 'sisa'),
    total_transaksi: angka(data, 'transaksi'),
  };

  res.json({ data, summary, tahun, jenis });
}));
