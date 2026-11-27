import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  RotateCcw,
  Edit,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  SearchX,
} from 'lucide-react';
import { Kas } from '../../types/kas';
import { kasService } from '../../lib/kasService';
import { KasFormModal } from './KasFormModal';
import { showToast } from '../../components/ui/Toast';
import { showUndoToast } from '../../components/ui/UndoToast';
import { authStore, AuthUser } from '../../store/authStore';
import { formatRupiah, formatSaldo } from '../../lib/formatter';
import { getKategoriKas } from '../../lib/kategoriKas';
import { exportLaporanToPdf } from '../../lib/exportHelper';

export const KasListPage: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const isPemilik = user?.role === 'pemilik';
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    authStore.getUser().then(setUser);
  }, []);

  const [kasList, setKasList] = useState<Kas[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJenis, setFilterJenis] = useState<string>('Semua');
  const [filterKategori, setFilterKategori] = useState<string>('Semua');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKasId, setSelectedKasId] = useState<string | null>(null);
  const [deleteConfirmKas, setDeleteConfirmKas] = useState<Kas | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await kasService.getKasList();
      setKasList(data);
    } catch {
      showToast('Gagal memuat data kas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Overall Totals (independent of table filters)
  const totalPemasukan = useMemo(() => {
    return kasList
      .filter((k) => k.jenis === 'Pemasukan')
      .reduce((sum, k) => sum + k.nominal, 0);
  }, [kasList]);

  const totalPengeluaran = useMemo(() => {
    return kasList
      .filter((k) => k.jenis === 'Pengeluaran')
      .reduce((sum, k) => sum + k.nominal, 0);
  }, [kasList]);

  const saldoKas = totalPemasukan - totalPengeluaran;

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Opsi filter: gabungan kategori dari Pengaturan + kategori yang ada di data
  // historis, supaya transaksi lama tetap bisa difilter.
  const kategoriFilterOptions = useMemo(() => {
    const config = getKategoriKas();
    const base =
      filterJenis === 'Pemasukan'
        ? config.pemasukan
        : filterJenis === 'Pengeluaran'
          ? config.pengeluaran
          : [...config.pemasukan, ...config.pengeluaran];
    const fromData = kasList
      .filter((k) => filterJenis === 'Semua' || k.jenis === filterJenis)
      .map((k) => k.kategori_nama);
    return Array.from(new Set([...base, ...fromData])).filter(Boolean);
  }, [filterJenis, kasList]);

  // Filtered List for Table
  const filteredList = useMemo(() => {
    return kasList.filter((item) => {
      // Jenis Filter
      if (filterJenis !== 'Semua' && item.jenis !== filterJenis) {
        return false;
      }
      // Kategori Filter
      if (filterKategori !== 'Semua' && item.kategori_nama !== filterKategori) {
        return false;
      }
      // Search Query — mencakup semua kolom yang tampil di tabel
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const fields = [
          item.tanggal,
          formatDateStr(item.tanggal),
          item.jenis,
          item.kategori_nama,
          item.keterangan || '',
          String(item.nominal),
          formatRupiah(item.nominal),
        ];
        if (!fields.some((field) => field.toLowerCase().includes(q))) return false;
      }
      // Date Range Filter
      if (startDate && item.tanggal < startDate) {
        return false;
      }
      if (endDate && item.tanggal > endDate) {
        return false;
      }

      return true;
    });
  }, [kasList, filterJenis, filterKategori, searchQuery, startDate, endDate]);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterJenis('Semua');
    setFilterKategori('Semua');
    setStartDate('');
    setEndDate('');
  };

  // Kategori yang tidak cocok dengan jenis baru dibersihkan agar tidak menghasilkan 0 data.
  const handleJenisChange = (jenis: string) => {
    setFilterJenis(jenis);
    setFilterKategori('Semua');
  };

  // Jaga agar rentang tanggal tidak terbalik.
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (value && endDate && value > endDate) setEndDate(value);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    if (value && startDate && value < startDate) setStartDate(value);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmKas) return;
    const target = deleteConfirmKas;
    try {
      await kasService.deleteKas(target.id);
      showToast('Transaksi kas berhasil dihapus', 'success');
      loadData();
      showUndoToast('Transaksi kas dihapus', 'Urungkan', async () => {
        try {
          await kasService.restoreKas(target);
          showToast('Transaksi kas dikembalikan', 'success');
          loadData();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'Gagal mengembalikan transaksi kas',
            'error'
          );
        }
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus transaksi kas', 'error');
    } finally {
      setDeleteConfirmKas(null);
    }
  };

  const handleExportPdf = () => {
    if (filteredList.length === 0) {
      showToast('Tidak ada transaksi kas untuk diekspor', 'error');
      return;
    }
    const currentYear = new Date().getFullYear();
    const sumMasuk = filteredList.filter((k) => k.jenis === 'Pemasukan').reduce((s, k) => s + k.nominal, 0);
    const sumKeluar = filteredList.filter((k) => k.jenis === 'Pengeluaran').reduce((s, k) => s + k.nominal, 0);
    const saldoNet = sumMasuk - sumKeluar;

    exportLaporanToPdf({
      title: 'Laporan Rekapitulasi Kas Keuangan',
      subtitle: `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      filename: `Laporan-Kas-${currentYear}`,
      orientation: 'portrait',
      filterInfo: [
        ...(searchQuery.trim() ? [{ label: 'Pencarian', value: searchQuery.trim() }] : []),
        { label: 'Jenis', value: filterJenis },
        { label: 'Kategori', value: filterKategori },
        ...(startDate ? [{ label: 'Dari Tanggal', value: startDate }] : []),
        ...(endDate ? [{ label: 'Sampai Tanggal', value: endDate }] : []),
      ],
      summaryMetrics: [
        { label: 'TOTAL PEMASUKAN', value: formatRupiah(sumMasuk) },
        { label: 'TOTAL PENGELUARAN', value: formatRupiah(sumKeluar) },
        { label: 'SALDO BERSIH', value: formatSaldo(saldoNet) },
        { label: 'JUMLAH TRANSAKSI', value: `${filteredList.length} Data` },
      ],
      headers: ['No', 'Tanggal', 'Kategori', 'Keterangan', 'Jenis', 'Nominal'],
      rows: filteredList.map((k, idx) => [
        idx + 1,
        k.tanggal,
        k.kategori_nama,
        k.keterangan || '-',
        k.jenis,
        `${k.jenis === 'Pemasukan' ? '+' : '-'} ${formatRupiah(k.nominal)}`,
      ]),
      footers: [
        [
          '',
          '',
          `TOTAL (${filteredList.length} Transaksi)`,
          `Masuk: ${formatRupiah(sumMasuk)} | Keluar: ${formatRupiah(sumKeluar)}`,
          'Saldo Bersih',
          formatSaldo(saldoNet),
        ],
      ],
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 35 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 32, halign: 'right' },
      },
    });
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Kas Pondok</h1>
          <p className="text-sm text-slate-500 mt-1">
            Catatan pemasukan dan pengeluaran keuangan pondok
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isPemilik && (
            <button
              onClick={() => {
                setSelectedKasId(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Transaksi</span>
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Saldo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Saldo Kas */}
        <div className="bg-[#059669] text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
              Saldo Kas
            </span>
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs">
              <Wallet className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight">
              {formatSaldo(saldoKas)}
            </div>
            <p className="text-[11px] text-emerald-100 mt-1">
              Selisih total pemasukan dan pengeluaran
            </p>
          </div>
        </div>

        {/* Card 2: Total Pemasukan */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Total Pemasukan
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-700 tracking-tight">
              {formatRupiah(totalPemasukan)}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1">Akumulasi seluruh pemasukan</p>
          </div>
        </div>

        {/* Card 3: Total Pengeluaran */}
        <div className="bg-red-50/70 border border-red-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-red-800 uppercase tracking-wider">
              Total Pengeluaran
            </span>
            <div className="p-2 rounded-xl bg-red-100 text-red-700">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-red-700 tracking-tight">
              {formatRupiah(totalPengeluaran)}
            </div>
            <p className="text-[11px] text-red-600 mt-1">Akumulasi seluruh pengeluaran</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Pencarian — paling besar & paling kiri */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari transaksi..."
              aria-label="Cari transaksi kas"
              className="w-full h-10 pl-9 pr-3 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-[#0F172A] placeholder:text-slate-400"
            />
          </div>

          {/* Jenis */}
          <select
            value={filterJenis}
            onChange={(e) => handleJenisChange(e.target.value)}
            aria-label="Jenis transaksi"
            title="Jenis transaksi"
            className="w-auto min-w-[120px] px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-slate-700"
          >
            <option value="Semua">Semua Jenis</option>
            <option value="Pemasukan">Pemasukan</option>
            <option value="Pengeluaran">Pengeluaran</option>
          </select>

          {/* Kategori */}
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            aria-label="Kategori transaksi"
            title="Kategori transaksi"
            className="w-auto min-w-[130px] px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-slate-700"
          >
            <option value="Semua">Semua Kategori</option>
            {kategoriFilterOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Rentang tanggal */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            aria-label="Dari tanggal"
            title="Dari tanggal"
            className="w-[140px] h-10 px-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-slate-700"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            aria-label="Sampai tanggal"
            title="Sampai tanggal"
            className="w-[140px] h-10 px-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-slate-700"
          />

          {/* Reset */}
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 h-10 px-3 text-sm text-slate-500 hover:text-slate-800 transition-colors rounded-lg hover:bg-slate-100 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 py-3 px-2 border-b border-slate-100">
                <div className="h-4 bg-slate-200 rounded w-1/6" />
                <div className="h-5 bg-slate-200 rounded-full w-20" />
                <div className="h-4 bg-slate-200 rounded w-1/5" />
                <div className="h-4 bg-slate-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center">
            {searchQuery || filterJenis !== 'Semua' || filterKategori !== 'Semua' || startDate || endDate ? (
              <div className="space-y-3">
                <SearchX className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-semibold text-[#0F172A]">Tidak ada transaksi cocok</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Coba sesuaikan kata kunci pencarian, kategori, atau filter rentang tanggal
                </p>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-semibold text-[#0F172A]">Belum Ada Transaksi Kas</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Mulai catat pemasukan dan pengeluaran keuangan pondok
                </p>
                {!isPemilik && (
                  <button
                    onClick={() => {
                      setSelectedKasId(null);
                      setModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Tambah Transaksi Pertama
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-semibold uppercase text-slate-500 select-none">
                  <th scope="col" className="px-4 py-3">Tanggal</th>
                  <th scope="col" className="px-4 py-3">Jenis</th>
                  <th scope="col" className="px-4 py-3">Kategori</th>
                  <th scope="col" className="px-4 py-3">Nominal</th>
                  <th scope="col" className="px-4 py-3">Keterangan</th>
                  <th scope="col" className="min-w-[100px] px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {formatDateStr(item.tanggal)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.jenis === 'Pemasukan' ? (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Pemasukan
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          Pengeluaran
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0F172A] whitespace-nowrap">
                      {item.kategori_nama}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono">
                      {item.jenis === 'Pemasukan' ? (
                        <span className="text-emerald-600 font-semibold">
                          + {formatRupiah(item.nominal)}
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold">
                          - {formatRupiah(item.nominal)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-xs">
                      {item.keterangan || '-'}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {!isPemilik && (
                          <button
                            onClick={() => {
                              setSelectedKasId(item.id);
                              setModalOpen(true);
                            }}
                            title="Edit Transaksi"
                            aria-label="Edit transaksi kas"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            onClick={() => setDeleteConfirmKas(item)}
                            title="Hapus Transaksi"
                            aria-label="Hapus transaksi kas"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredList.map((item) => (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{item.kategori_nama}</p>
                      <p className="text-[11px] text-slate-500">{formatDateStr(item.tanggal)}</p>
                    </div>
                    <span
                      className={`text-sm font-bold whitespace-nowrap ${
                        item.jenis === 'Pemasukan' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {item.jenis === 'Pemasukan' ? '+' : '-'} {formatRupiah(item.nominal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        item.jenis === 'Pemasukan'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {item.jenis}
                    </span>
                    <div className="flex items-center gap-1">
                      {!isPemilik && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedKasId(item.id);
                            setModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-semibold"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmKas(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 text-[11px] font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      )}
                    </div>
                  </div>
                  {item.keterangan && (
                    <p className="text-xs text-slate-500">{item.keterangan}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Form Tambah/Edit */}
      <KasFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        kasId={selectedKasId}
        onSuccess={loadData}
      />

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmKas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setDeleteConfirmKas(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Hapus Transaksi Kas</h3>
                <p className="text-xs text-slate-500 font-semibold">
                  {deleteConfirmKas.kategori_nama} — {formatRupiah(deleteConfirmKas.nominal)}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Yakin ingin menghapus catatan transaksi ini? Saldo kas akan dihitung ulang.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirmKas(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors shadow-xs"
              >
                Hapus Transaksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KasListPage;
