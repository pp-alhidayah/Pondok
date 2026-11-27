import React, { useState, useEffect } from 'react';
import { CheckCircle2, Download, Printer, X, Plus } from 'lucide-react';
import {
  generateKwitansiPdf,
  printKwitansiHvsHtml,
  printKwitansiThermalHtml,
  terbilang,
  getKwitansiConfig,
} from '../../lib/pdfHelper';
import { pengaturanService } from '../../lib/pengaturanService';
import { kopSuratService } from '../../lib/kopSuratService';
import { formatRupiah } from '../../lib/formatter';
import { ProfilPondok } from '../../types/pengaturan';
import { KwitansiConfig } from '../../lib/pdfHelper';

export interface StrukItem {
  deskripsi: string;
  nominal: number;
}

export interface StrukData {
  idTransaksi: string;
  tipe: 'Syahriyah' | 'Kilatan' | 'Iuran' | 'Lainnya';
  namaPembayar: string;
  nisPembayar?: string;
  kategoriPembayar?: string;
  tanggalBayar: string;
  metode: string;
  items: StrukItem[];
  iuranTambahan?: StrukItem[];
  totalPembayaran: number;
  keterangan?: string;
  rawRecord?: any;
  santriObj?: any;
}

interface StrukPembayaranCardProps {
  data: StrukData;
  onClose: () => void;
  onNewPayment?: () => void;
}

export const StrukPembayaranCard: React.FC<StrukPembayaranCardProps> = ({
  data,
  onClose,
  onNewPayment,
}) => {
  const [profil, setProfil] = useState<ProfilPondok | null>(null);
  const [config, setConfig] = useState<KwitansiConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    pengaturanService.getProfil().then((p) => {
      if (mounted) setProfil(p);
    });
    getKwitansiConfig().then((c) => {
      if (mounted) setConfig(c);
    });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!config || !config.auto_print) return;
    const timer = setTimeout(() => {
      if (config.auto_print_mode === 'hvs') {
        handlePrintHvs();
      } else {
        handlePrintThermal();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [config]);

  if (!profil || !config) return null;

  const themeColor = config.hvs.warna_tema || '#059669';
  const kopDesainAktif = config.gunakan_kop_desain && kopSuratService.isAktif();
  const kopDesainImg = kopDesainAktif ? kopSuratService.getImage() : null;
  const kopLines = (config.kop_surat || '').split('\n').filter((l) => l.trim());

  const handleDownloadPdf = async () => {
    if (data.rawRecord) {
      await generateKwitansiPdf(
        data.rawRecord,
        data.santriObj || {
          nama: data.namaPembayar,
          nis: data.nisPembayar,
          kategori: data.kategoriPembayar,
        }
      );
    } else {
      await generateKwitansiPdf({
        idTransaksi: data.idTransaksi,
        tipe: data.tipe === 'Iuran' ? 'Lainnya' : data.tipe,
        santri: data.santriObj || {
          nama: data.namaPembayar,
          nis: data.nisPembayar || '-',
          kategori: data.kategoriPembayar || 'Umum',
        },
        tanggalBayar: data.tanggalBayar,
        metode: data.metode,
        items: data.items,
        iuranTambahan: data.iuranTambahan || [],
        totalPembayaran: data.totalPembayaran,
        keterangan: data.keterangan || '',
      });
    }
  };

  const handlePrintHvs = async () => {
    if (data.rawRecord) {
      await printKwitansiHvsHtml(
        data.rawRecord,
        data.santriObj || {
          nama: data.namaPembayar,
          nis: data.nisPembayar,
          kategori: data.kategoriPembayar,
        }
      );
    } else {
      await printKwitansiHvsHtml({
        idTransaksi: data.idTransaksi,
        tipe: data.tipe === 'Iuran' ? 'Lainnya' : data.tipe,
        santri: data.santriObj || {
          nama: data.namaPembayar,
          nis: data.nisPembayar || '-',
          kategori: data.kategoriPembayar || 'Umum',
        },
        tanggalBayar: data.tanggalBayar,
        metode: data.metode,
        items: data.items,
        iuranTambahan: data.iuranTambahan || [],
        totalPembayaran: data.totalPembayaran,
        keterangan: data.keterangan || '',
      });
    }
  };

  const handlePrintThermal = async () => {
    if (data.rawRecord) {
      await printKwitansiThermalHtml(
        data.rawRecord,
        data.santriObj || {
          nama: data.namaPembayar,
          nis: data.nisPembayar,
          kategori: data.kategoriPembayar,
        }
      );
    } else {
      await printKwitansiThermalHtml({
        idTransaksi: data.idTransaksi,
        tipe: data.tipe === 'Iuran' ? 'Lainnya' : data.tipe,
        santri: data.santriObj || {
          nama: data.namaPembayar,
          nis: data.nisPembayar || '-',
          kategori: data.kategoriPembayar || 'Umum',
        },
        tanggalBayar: data.tanggalBayar,
        metode: data.metode,
        items: data.items,
        iuranTambahan: data.iuranTambahan || [],
        totalPembayaran: data.totalPembayaran,
        keterangan: data.keterangan || '',
      });
    }
  };

  const allItems = [...data.items, ...(data.iuranTambahan || [])];
  const tampilkanPengasuh = config.hvs.tampilkan_pengasuh || config.thermal.tampilkan_pengasuh;
  const tampilkanTtd = config.hvs.tampilkan_tanda_tangan || config.thermal.tampilkan_tanda_tangan;

  return (
    <>
      {/* 1. Standard App Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-slate-50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">
                Pembayaran Berhasil Dicatat
              </h2>
              {config.auto_print && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                  Auto-Print: {config.auto_print_mode === 'hvs' ? 'HVS' : 'Thermal'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Bukti transaksi sah telah dibukukan otomatis ke Buku Kas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          title="Tutup"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Standard Scrollable Modal Body (Desain Format Kwitansi Pengaturan) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
        <div
          className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 sm:p-6 max-w-[560px] w-full mx-auto space-y-3.5 text-slate-800"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {/* Header Kop Surat (Format Pengaturan Kwitansi) */}
          {kopDesainImg ? (
            <img
              src={kopDesainImg}
              alt="Kop Surat"
              className="w-full max-h-24 object-contain mx-auto mb-2"
            />
          ) : (
            <div
              className="pb-2 text-center"
              style={{ borderBottom: `2.5px double ${themeColor}` }}
            >
              {kopLines.length > 0 ? (
                kopLines.map((l, i) => (
                  <div
                    key={i}
                    className={i === 0 ? 'font-bold text-base' : 'text-xs text-slate-600'}
                    style={{
                      color: i === 0 ? themeColor : '#475569',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {l}
                  </div>
                ))
              ) : (
                <>
                  <div className="font-bold text-base" style={{ color: themeColor }}>
                    {profil.nama_pondok || 'PONDOK PESANTREN AL HIDAYAH TERTEK'}
                  </div>
                  <div className="text-xs text-slate-600">
                    {profil.alamat || 'Jln. Mayor Bismo No 71-73 Tertek Pare Kediri'}
                  </div>
                  {profil.kontak && (
                    <div className="text-[11px] text-slate-500">
                      Telp: {profil.kontak} {profil.email ? `| Email: ${profil.email}` : ''}
                    </div>
                  )}
                </>
              )}
              {tampilkanPengasuh && (
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Pengasuh: {profil.pengasuh || '-'}
                </div>
              )}
            </div>
          )}

          {/* Judul Kwitansi & Nomor Transaksi */}
          <div className="text-center pt-1">
            <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              {config.judul_kwitansi || 'KWITANSI PEMBAYARAN'}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              No: {data.idTransaksi}
            </p>
          </div>

          {/* Informasi Santri & Transaksi (Grid Format Kwitansi HVS) */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded p-2.5 flex flex-col sm:flex-row justify-between gap-2 text-xs text-[#1e293b]">
            <div className="space-y-0.5">
              <div>
                <span className="font-bold">Telah Terima Dari</span>: {data.namaPembayar}
              </div>
              <div>
                <span className="font-bold">NIS / Kategori</span>: {data.nisPembayar || '-'} ({data.kategoriPembayar || 'Santri'})
              </div>
            </div>
            <div className="space-y-0.5 sm:text-right">
              <div>
                <span className="font-bold">Tanggal Bayar</span>: {data.tanggalBayar}
              </div>
              <div>
                <span className="font-bold">Metode</span>: {data.metode || 'Tunai'}
              </div>
            </div>
          </div>

          {/* Tabel Rincian Pembayaran */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="text-white font-bold" style={{ backgroundColor: themeColor }}>
                  <th className="px-2.5 py-1.5 w-8 text-center border border-slate-300">No</th>
                  <th className="px-2.5 py-1.5 border border-slate-300">Rincian Pembayaran</th>
                  <th className="px-2.5 py-1.5 text-right w-28 border border-slate-300">Nominal</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {allItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-2.5 py-1.5 text-center text-slate-600 border border-slate-300 font-mono">{idx + 1}</td>
                    <td className="px-2.5 py-1.5 text-slate-800 border border-slate-300">{item.deskripsi}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-slate-900 border border-slate-300">
                      {formatRupiah(item.nominal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f1f5f9] font-bold">
                  <td colSpan={2} className="px-2.5 py-1.5 text-slate-900 border border-slate-300 uppercase">
                    TOTAL PEMBAYARAN
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-slate-900 border border-slate-300">
                    {formatRupiah(data.totalPembayaran)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Terbilang & Catatan */}
          <div className="text-[11px] text-slate-700 space-y-1">
            {config.tampilkan_terbilang && (
              <div>
                <span className="font-bold">Terbilang :</span> <i className="italic"># {terbilang(data.totalPembayaran)} #</i>
              </div>
            )}
            <div className="text-slate-400">
              Catatan: {data.keterangan || config.footer_kwitansi || '-'}
            </div>
          </div>

          {/* Area Tanda Tangan */}
          {tampilkanTtd && (
            <div className="pt-4 flex justify-between items-end text-xs text-slate-800">
              <div className="w-[30%] text-center">
                <div>Penyetor,</div>
                <div className="h-10" />
                <div className="border-b border-slate-500 mx-1" />
                <div className="font-bold mt-1 text-slate-900">{data.namaPembayar}</div>
              </div>
              <div className="w-[34%] text-center">
                <div>
                  {(config.kota_kuitansi || 'Pare').trim()}, {data.tanggalBayar}
                </div>
                <div>
                  {config.gelar_penandatangan || 'Bendahara Pondok'},
                </div>
                <div className="h-10" />
                <div className="border-b border-slate-500 mx-1" />
                <div className="font-bold mt-1 text-slate-900">
                  {config.nama_penandatangan || profil.bendahara || '-'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Standard App Modal Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-slate-50 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full sm:w-auto flex-1">
          <button
            type="button"
            onClick={handlePrintHvs}
            className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Hvs </span>
          </button>

          <button
            type="button"
            onClick={handlePrintThermal}
            className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Thermal </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3.5 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Unduh PDF </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          Tutup
        </button>
      </div>
    </>
  );
};

export default StrukPembayaranCard;
