import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  RotateCcw,
  Check,
  Clock,
  SearchX,
  ShieldAlert,
  Percent,
  ReceiptText,
  Undo2,
  ChevronDown,
  Printer,
} from 'lucide-react';
import { SyahriyahBulan, SyahriyahTransaksiRecord } from '../../types/syahriyah';
import { Santri } from '../../types/santri';
import { syahriyahService, isBeforeEntry, isSyahriyahSetelahKeluar } from '../../lib/syahriyahService';
import { todayLocal } from '../../lib/core';
import { formatRupiah } from '../../lib/formatter';
import { showToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pagination } from '../../components/ui/Pagination';
import { SyahriyahPaymentModal } from './SyahriyahPaymentModal';
import { StrukPembayaranCard, StrukData, StrukItem } from '../../components/ui/StrukPembayaranCard';


import { waiverService, labelKeringanan, SyahriyahWaiver } from '../../lib/waiverService';
import { authStore, AuthUser } from '../../store/authStore';

const BULAN_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

interface MatrixRow {
  santri: Santri;
  records: SyahriyahBulan[];
}

export const SyahriyahListPage: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const isPemilik = user?.role === 'pemilik';

  useEffect(() => {
    authStore.getUser().then(setUser);
  }, []);

  const currentYear = new Date().getFullYear();
  const [tahun, setTahun] = useState<number>(currentYear);
  const [filterKategori, setFilterKategori] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Payment Modal states
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [activeSantri, setActiveSantri] = useState<Santri | null>(null);
  const [activeBulanNum, setActiveBulanNum] = useState<number | null>(null);

  // Riwayat transaksi & pembatalan
  const [showRiwayat, setShowRiwayat] = useState<boolean>(false);
  const [riwayatList, setRiwayatList] = useState<SyahriyahTransaksiRecord[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState<boolean>(false);
  const [cancelTarget, setCancelTarget] = useState<SyahriyahTransaksiRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [strukModalOpen, setStrukModalOpen] = useState<boolean>(false);
  const [savedStrukData, setSavedStrukData] = useState<StrukData | null>(null);

  const [matrixData, setMatrixData] = useState<MatrixRow[]>([]);
  const [waivers, setWaivers] = useState<SyahriyahWaiver[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadMatrix = async () => {
    setIsLoading(true);
    try {
      const [data, daftarKeringanan] = await Promise.all([
        syahriyahService.getSyahriyahMatrix(tahun),
        waiverService.getAll(undefined, tahun),
      ]);
      setMatrixData(data);
      setWaivers(daftarKeringanan);
    } catch {
      showToast('Gagal memuat matriks syahriyah', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, [tahun]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterKategori, searchQuery, tahun]);

  // Filtered matrix rows
  const filteredMatrix = useMemo(() => {
    return matrixData.filter(({ santri }) => {
      if (filterKategori !== 'Semua' && santri.kategori !== filterKategori) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchNama = santri.nama.toLowerCase().includes(q);
        const matchNis = santri.nis.toLowerCase().includes(q);
        const matchWali = santri.nama_wali.toLowerCase().includes(q);
        if (!matchNama && !matchNis && !matchWali) return false;
      }
      return true;
    });
  }, [matrixData, filterKategori, searchQuery]);

  // Paginated Matrix
  const totalFiltered = filteredMatrix.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  const paginatedMatrix = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMatrix.slice(start, start + pageSize);
  }, [filteredMatrix, currentPage, pageSize]);

  const startItem = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalFiltered);

  // Jika filter/data menyusut, jangan biarkan halaman aktif melewati batas.
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  const handleCellClick = (santri: Santri, record: SyahriyahBulan) => {
    if (isPemilik) return;
    if (isBeforeEntry(santri.tanggal_masuk, record.tahun, record.bulan)) {
      showToast('Pembayaran tidak dapat dilakukan karena sebelum tanggal santri masuk', 'error');
      return;
    }
    if (isSyahriyahSetelahKeluar(santri, record.tahun, record.bulan)) {
      showToast('Pembayaran tidak dapat dilakukan karena santri tidak aktif pada bulan tersebut', 'error');
      return;
    }
    setActiveSantri(santri);
    setActiveBulanNum(record.bulan);
    setPaymentModalOpen(true);
  };

  const handleTambahPembayaran = () => {
    if (isPemilik) return;
    setActiveSantri(null);
    setActiveBulanNum(null);
    setPaymentModalOpen(true);
  };

  // ── Riwayat Transaksi & Pembatalan ─────────────────────────────────
  const muatRiwayat = async () => {
    setRiwayatLoading(true);
    try {
      const list = await syahriyahService.getTransaksiList();
      setRiwayatList(
        list
          .filter((r) => (r.items || []).some((it) => it.tahun === tahun))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
      );
    } catch {
      showToast('Gagal memuat riwayat transaksi', 'error');
    } finally {
      setRiwayatLoading(false);
    }
  };

  // Muat ulang riwayat saat panel dibuka atau tahun diganti
  useEffect(() => {
    if (showRiwayat) muatRiwayat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRiwayat, tahun]);

  const confirmBatalkan = async () => {
    const target = cancelTarget;
    if (!target || isCancelling) return;
    setIsCancelling(true);
    try {
      await syahriyahService.batalkanPembayaran(target.id);
      showToast(
        `Pembayaran ${target.nomor_kuitansi || target.id} telah dibatalkan`,
        'success',
      );
      setCancelTarget(null);
      await Promise.all([loadMatrix(), muatRiwayat()]);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal membatalkan pembayaran',
        'error',
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const lihatStrukSyahriyah = (r: SyahriyahTransaksiRecord) => {
    const items: StrukItem[] = r.items.map((it) => ({
      deskripsi: `Syahriyah ${BULAN_NAMES[it.bulan - 1] || it.bulan} ${it.tahun} (${it.jenis})`,
      nominal: it.nominal,
    }));
    const strukData: StrukData = {
      idTransaksi: r.nomor_kuitansi || r.id,
      tipe: 'Syahriyah',
      namaPembayar: r.santri_nama,
      nisPembayar: r.santri_nis || '-',
      kategoriPembayar: 'Santri',
      tanggalBayar: r.transaksi_data?.tanggal_bayar || todayLocal(),
      metode: r.transaksi_data?.metode || 'Tunai',
      items,
      totalPembayaran: r.total_pembayaran,
      keterangan: r.transaksi_data?.keterangan || '',
      rawRecord: r,
      santriObj: {
        nama: r.santri_nama,
        nis: r.santri_nis,
        kategori: 'Santri',
      },
    };
    setSavedStrukData(strukData);
    setStrukModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Syahriyah (Iuran Bulanan)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rekap matriks pembayaran iuran bulanan santri 
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isPemilik && (
            <button
              onClick={handleTambahPembayaran}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>+ Catat Pembayaran</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-center">
          {/* Search Bar */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama santri, NIS, atau wali..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-[#0F172A]"
            />
          </div>

          {/* Tahun Dropdown */}
          <div>
            <select
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-slate-700 font-semibold cursor-pointer"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </div>

          {/* Kategori Dropdown */}
          <div>
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-slate-700 cursor-pointer"
            >
              <option value="Semua">Semua Kategori</option>
              <option value="Mukim">Mukim</option>
              <option value="Nduduk">Nduduk</option>
            </select>
          </div>
        </div>

        {/* Reset Filter Action */}
        {(searchQuery || filterKategori !== 'Semua' || tahun !== currentYear) && (
          <div className="flex justify-end pt-3 border-t border-slate-100 mt-3">
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterKategori('Semua');
                setTahun(currentYear);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors py-1 px-2.5 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* Matriks Table Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex gap-3 items-center">
                <div className="w-44 h-8 bg-slate-200 rounded-md shrink-0" />
                <div className="flex-1 grid grid-cols-12 gap-2">
                  {Array.from({ length: 12 }).map((_, j) => (
                    <div key={j} className="h-8 bg-slate-200 rounded-md" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredMatrix.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <SearchX className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-[#0F172A]">Tidak Ada Santri Cocok</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Coba sesuaikan kata kunci pencarian atau filter kategori
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterKategori('Semua');
                setTahun(2025);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-auto max-h-[600px] relative">
              <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="sticky top-0 z-20 bg-slate-100 border-b border-[#E2E8F0] text-xs font-semibold text-slate-700 select-none">
                  {/* Top-Left Sticky Corner Header */}
                  <th
                    scope="col"
                    className="sticky top-0 left-0 z-30 bg-slate-100 px-3 py-3 border-r border-b border-[#E2E8F0] min-w-[210px] shadow-xs"
                  >
                    Santri / Bulan
                  </th>
                  {BULAN_NAMES.map((m) => (
                    <th
                      key={m}
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-100 px-2 py-3 text-center border-r border-b border-[#E2E8F0] min-w-[72px] uppercase tracking-wider text-slate-700"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedMatrix.map(({ santri, records }) => {
                  const waiverSantri = waivers.find((w) => w.santri_id === santri.id);
                  return (
                    <tr key={santri.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Sticky left column for santri name */}
                      <td
                        className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 px-3 py-2.5 border-r border-slate-200 min-w-[210px] shadow-xs transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#0F172A] truncate max-w-[150px]">
                            {santri.nama}
                          </span>
                            {waiverSantri && (
                              <span
                                title={`${labelKeringanan(waiverSantri)} · ${BULAN_NAMES[waiverSantri.bulan_mulai - 1]}–${BULAN_NAMES[waiverSantri.bulan_selesai - 1]}`}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap"
                              >
                                Keringanan
                              </span>
                            )}
                          </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono text-slate-600">{santri.nis}</span>
                          <span>•</span>
                          <span className="font-medium text-[#059669]">{santri.kategori}</span>
                        </div>
                      </td>

                      {/* 12 Month Cells */}
                      {records.map((rec) => {
                        const sisaTagihan = Math.max(0, (rec.nominal_tagihan || 0) - (rec.total_dibayar || 0));
                        const isBefore = isBeforeEntry(santri.tanggal_masuk, rec.tahun, rec.bulan);
                        const isAfter = isSyahriyahSetelahKeluar(santri, rec.tahun, rec.bulan);
                        const isOff = isBefore || isAfter;

                        return (
                          <td
                            key={rec.bulan}
                            onClick={isPemilik || isOff ? undefined : () => handleCellClick(santri, rec)}
                            className={`p-1 text-center border-r border-slate-100 select-none relative group/cell ${
                              isPemilik
                                ? 'cursor-default'
                                : isOff
                                  ? 'cursor-not-allowed bg-slate-50/60'
                                  : 'cursor-pointer'
                            }`}
                          >
                            {/* Custom Floating Hover Tooltip */}
                            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150 pointer-events-none z-30 whitespace-nowrap shadow-lg">
                              {isAfter ? (
                                <div className="bg-slate-800 text-white font-medium text-[11px] px-2.5 py-1 rounded-md shadow-md border border-slate-700">
                                  Tidak Ditagih (Tidak Aktif)
                                </div>
                              ) : isBefore ? (
                                <div className="bg-slate-800 text-white font-medium text-[11px] px-2.5 py-1 rounded-md shadow-md border border-slate-700">
                                  Belum Masuk (Masuk: {santri.tanggal_masuk})
                                </div>
                              ) : rec.status === 'Lunas' ? (
                                <div className="bg-emerald-800 text-white font-medium text-[11px] px-2.5 py-1 rounded-md shadow-md border border-emerald-700">
                                  Lunas: {formatRupiah(rec.nominal_tagihan)}
                                </div>
                              ) : rec.status === 'Sebagian' ? (
                                <div className="bg-amber-800 text-white font-medium text-[11px] px-2.5 py-1 rounded-md shadow-md border border-amber-700">
                                  Kurang: {formatRupiah(sisaTagihan)}
                                </div>
                              ) : (
                                <div className="bg-slate-800 text-white font-medium text-[11px] px-2.5 py-1 rounded-md shadow-md border border-slate-700">
                                  Belum Bayar
                                </div>
                              )}
                            </div>

                            {/* Cell Badge */}
                            {isOff ? (
                              <div className="w-full py-1.5 px-1 rounded-md bg-slate-200 text-slate-500 font-bold text-[11px] border border-slate-300 flex items-center justify-center shadow-2xs">
                                <span>—</span>
                              </div>
                            ) : rec.status === 'Lunas' ? (
                              <div className="w-full py-1.5 px-1 rounded-md bg-emerald-100/80 hover:bg-emerald-200/90 text-emerald-800 font-bold text-[12px] border border-emerald-200 flex items-center justify-center gap-0.5 transition-colors shadow-2xs">
                                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              </div>
                            ) : rec.status === 'Sebagian' ? (
                              <div className="w-full py-1.5 px-1 rounded-md bg-amber-100/80 hover:bg-amber-200/90 text-amber-800 font-bold text-[11px] border border-amber-200 flex items-center justify-center gap-0.5 transition-colors shadow-2xs">
                                <span>½</span>
                              </div>
                            ) : (
                              <div className="w-full py-1.5 px-1 rounded-md bg-slate-100 hover:bg-slate-200/70 text-slate-400 font-medium text-[11px] border border-slate-200 flex items-center justify-center transition-colors">
                                <span>—</span>
                              </div>
                            )}

                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedMatrix.map(({ santri, records }) => {
                const totalDibayar = records.reduce((sum, rec) => sum + (rec.total_dibayar || 0), 0);
                const waiverSantri = waivers.find((w) => w.santri_id === santri.id);
                return (
                  <div key={santri.id} className="p-3 space-y-2">
                    {/* Info santri — rapat dengan grid bulan */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-[#0F172A]">{santri.nama}</p>
                        {waiverSantri && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                            Keringanan
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        <span className="font-mono">{santri.nis}</span> • {santri.kategori}
                      </p>
                    </div>

                    {/* Grid bulan: 6 kolom (2 baris) dengan target tap besar + indikator warna */}
                    <div className="grid grid-cols-6 gap-1.5">
                      {records.map((rec) => {
                        const isOff =
                          isBeforeEntry(santri.tanggal_masuk, rec.tahun, rec.bulan) ||
                          isSyahriyahSetelahKeluar(santri, rec.tahun, rec.bulan);
                        return (
                          <button
                            key={rec.bulan}
                            type="button"
                            disabled={isPemilik || isOff}
                            onClick={() => handleCellClick(santri, rec)}
                            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border py-2 text-center transition-all active:scale-95 ${
                              isOff
                                ? 'border-slate-200 bg-slate-100 text-slate-400'
                                : rec.status === 'Lunas'
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                  : rec.status === 'Sebagian'
                                    ? 'border-amber-300 bg-amber-100 text-amber-700'
                                    : 'border-rose-200 bg-rose-50 text-rose-500'
                            }`}
                          >
                            <span className="block text-[10px] font-semibold leading-none opacity-80">
                              {BULAN_NAMES[rec.bulan - 1] || rec.bulan}
                            </span>
                            <span className="text-base font-extrabold leading-none">
                              {isOff ? '—' : rec.status === 'Lunas' ? '✓' : rec.status === 'Sebagian' ? '½' : '•'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Total dibayar — badge menonjol */}
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Total dibayar
                      </span>
                      <span
                        className={`text-sm font-extrabold tabular-nums ${
                          totalDibayar > 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatRupiah(totalDibayar)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer Tabel & Pagination Controls */}
        {!isLoading && filteredMatrix.length > 0 && (
          <div className="p-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 bg-slate-50/50">
            <div>
              Menampilkan <span className="font-semibold text-[#0F172A]">{startItem}-{endItem}</span> dari{' '}
              <span className="font-semibold text-[#0F172A]">{totalFiltered}</span> santri
            </div>

            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalFiltered}
              label="santri"
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Legend Warna */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-slate-700">Keterangan Status:</span>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 inline-block shrink-0" />
            <span className="text-slate-600 font-medium">Lunas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 inline-block shrink-0" />
            <span className="text-slate-600 font-medium">Bayar Sebagian</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300 inline-block shrink-0" />
            <span className="text-slate-600 font-medium">Belum Bayar</span>
          </div>
        </div>

        <div className="text-slate-400 italic">
          * Klik sel bulan untuk mencatat pembayaran Syahriyah santri
        </div>
      </div>

      {/* Riwayat Transaksi (collapsible) */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
        <button
          onClick={() => setShowRiwayat((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <ReceiptText className="w-4.5 h-4.5 text-[#059669]" />
            <span className="font-bold text-[#0F172A] text-sm">
              Riwayat Transaksi {tahun}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${showRiwayat ? 'rotate-180' : ''}`}
          />
        </button>

        {showRiwayat && (
          <div className="border-t border-slate-100 px-4 sm:px-6 py-4">
            {riwayatLoading ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                Memuat riwayat...
              </div>
            ) : riwayatList.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                Belum ada transaksi pada tahun {tahun}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase tracking-wider border-b border-slate-200">
                      <th className="px-3 py-2 font-semibold">Tanggal</th>
                      <th className="px-3 py-2 font-semibold">No. Kuitansi</th>
                      <th className="px-3 py-2 font-semibold">Santri</th>
                      <th className="px-3 py-2 font-semibold">Bulan</th>
                      <th className="px-3 py-2 font-semibold text-right">Total</th>
                      <th className="px-3 py-2 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {riwayatList.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                          {r.transaksi_data?.tanggal_bayar
                            ? new Date(r.transaksi_data.tanggal_bayar).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[#0F172A] whitespace-nowrap">
                          {r.nomor_kuitansi || r.id}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {r.santri_nama}
                          <span className="text-slate-400"> ({r.santri_nis})</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-[220px]">
                          {(r.items || [])
                            .filter((it) => it.tahun === tahun)
                            .map((it) => `${BULAN_NAMES[it.bulan - 1] || it.bulan}${it.jenis === 'Sebagian' ? '*' : ''}`)
                            .join(', ') || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#0F172A] whitespace-nowrap">
                          {formatRupiah(r.total_pembayaran)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => lihatStrukSyahriyah(r)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#059669] text-[#059669] hover:bg-[#059669]/10 font-semibold transition-colors text-[11px]"
                              title="Lihat Struk"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Struk</span>
                            </button>
                            {!isPemilik && (
                              <button
                                onClick={() => setCancelTarget(r)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 font-semibold transition-colors text-[11px]"
                                title="Batalkan transaksi ini"
                              >
                                <Undo2 className="w-3 h-3" />
                                Batalkan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-slate-400 mt-2">
                  * = pembayaran sebagian. Membatalkan transaksi mengembalikan status bulan,
                  menghapus entri kas terkait, dan nomor kuitansi tidak dipakai ulang.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Pembayaran Syahriyah */}
      <SyahriyahPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        santri={activeSantri}
        tahunAktif={tahun}
        bulanAktif={activeBulanNum}
        onSuccess={loadMatrix}
      />

      {/* Konfirmasi Pembatalan Pembayaran */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        title="Batalkan Pembayaran"
        message={`Batalkan transaksi ${
          cancelTarget?.nomor_kuitansi || cancelTarget?.id || ''
        } (${cancelTarget?.santri_nama || ''}) sebesar ${
          cancelTarget ? formatRupiah(cancelTarget.total_pembayaran) : ''
        }?\n\nTotal bayar bulan terkait akan dikurangi kembali, entri kas dibatalkan, dan kwitansi tidak berlaku lagi.`}
        confirmLabel="Ya, Batalkan"
        variant="warning"
        onConfirm={confirmBatalkan}
        onClose={() => {
          if (!isCancelling) setCancelTarget(null);
        }}
      />

      {/* Modal Lihat Struk */}
      {strukModalOpen && savedStrukData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => {
              setStrukModalOpen(false);
              setSavedStrukData(null);
            }}
          />
          <div className="relative w-full max-w-2xl bg-white h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden">
            <StrukPembayaranCard
              data={savedStrukData}
              onClose={() => {
                setStrukModalOpen(false);
                setSavedStrukData(null);
              }}
              onNewPayment={() => {
                setStrukModalOpen(false);
                setSavedStrukData(null);
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default SyahriyahListPage;
