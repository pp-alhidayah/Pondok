import { todayLocal, currentYmLocal } from '../../lib/core';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  HandCoins,
  User,
  Users,
  Calendar,
  Printer,
  Undo2,
} from 'lucide-react';
import { MasterIuran, JenisPeriodeIuran } from '../../types/pengaturan';
import { IuranPembayaran } from '../../types/iuranPembayaran';
import { Santri } from '../../types/santri';
import {
  iuranPembayaranService,
  getMasterIuranAktif,
} from '../../lib/iuranPembayaranService';
import { santriService } from '../../lib/santriService';
import { formatRupiah, formatThousand, parseThousand } from '../../lib/formatter';
import { showToast } from '../../components/ui/Toast';
import { authStore, AuthUser } from '../../store/authStore';
import { StrukPembayaranCard, StrukData } from '../../components/ui/StrukPembayaranCard';
import { PrintStatusBadge } from '../../components/ui/PrintStatusBadge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

function todayISO(): string {
  return todayLocal();
}

function currentYearMonth(): string {
  return currentYmLocal();
}

function currentYear(): number {
  return new Date().getFullYear();
}

function labelPeriode(j: JenisPeriodeIuran): string {
  if (j === 'sekali') return 'Sekali';
  if (j === 'bulanan') return 'Bulanan';
  return 'Tahunan';
}

const BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

function formatPeriodeRecord(r: IuranPembayaran): string {
  if (r.periode_bulan) {
    const [year, month] = r.periode_bulan.split('-').map((v) => parseInt(v, 10));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return r.periode_bulan;
    }
    return `${BULAN_SHORT[month - 1]} ${year}`;
  }
  if (r.periode_tahun) return String(r.periode_tahun);
  return '—';
}

const IuranListPage: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const isPemilik = user?.role === 'pemilik';

  useEffect(() => {
    authStore.getUser().then(setUser);
  }, []);

  const [list, setList] = useState<IuranPembayaran[]>([]);
  const [masterList, setMasterList] = useState<MasterIuran[]>([]);
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [search, setSearch] = useState('');
  const [filterIuran, setFilterIuran] = useState('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedStrukData, setSavedStrukData] = useState<StrukData | null>(null);
  const [cancelTarget, setCancelTarget] = useState<IuranPembayaran | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Form
  const [iuranId, setIuranId] = useState('');
  const [tipePembayar, setTipePembayar] = useState<'santri' | 'umum'>('santri');
  const [santriId, setSantriId] = useState('');
  const [namaPembayar, setNamaPembayar] = useState('');
  const [santriSearch, setSantriSearch] = useState('');
  const [periodeBulan, setPeriodeBulan] = useState(currentYearMonth());
  const [periodeTahun, setPeriodeTahun] = useState(currentYear());
  const [nominalStr, setNominalStr] = useState('0');
  const [tanggalBayar, setTanggalBayar] = useState(todayISO());
  const [metode, setMetode] = useState('Tunai');
  const [keterangan, setKeterangan] = useState('');

  const selectedMaster = useMemo(
    () => masterList.find((m) => m.id === iuranId) || null,
    [masterList, iuranId]
  );

  const load = async () => {
    setList(await iuranPembayaranService.getAll());
    setMasterList(await getMasterIuranAktif());
  };

  useEffect(() => {
    load();
    santriService
      .getSantriList()
      .then(setSantriList)
      .catch(() => showToast('Gagal memuat daftar santri', 'error'));
  }, []);

  const filtered = useMemo(() => {
    let rows = list;
    if (filterIuran !== 'Semua') {
      rows = rows.filter((r) => r.iuran_id === filterIuran);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.nama_pembayar.toLowerCase().includes(q) ||
          r.iuran_nama.toLowerCase().includes(q) ||
          (r.keterangan || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [list, filterIuran, search]);

  const filteredSantri = useMemo(() => {
    const q = santriSearch.trim().toLowerCase();
    if (!q) return santriList.slice(0, 30);
    return santriList
      .filter(
        (s) =>
          s.nama.toLowerCase().includes(q) ||
          (s.nis || '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [santriList, santriSearch]);

  const openModal = async () => {
    if (isPemilik) return;
    const aktif = await getMasterIuranAktif();
    setMasterList(aktif);
    const first = aktif[0];
    setIuranId(first?.id || '');
    setTipePembayar('santri');
    setSantriId('');
    setNamaPembayar('');
    setSantriSearch('');
    setPeriodeBulan(currentYearMonth());
    setPeriodeTahun(currentYear());
    setNominalStr(
      first ? formatThousand(first.nominal_default) : '0'
    );
    setTanggalBayar(todayISO());
    setMetode('Tunai');
    setKeterangan('');
    setSavedStrukData(null);
    setIsModalOpen(true);
  };

  const confirmBatalkan = async () => {
    const target = cancelTarget;
    if (!target || isCancelling) return;
    setIsCancelling(true);
    try {
      await iuranPembayaranService.batalkanPembayaran(target.id);
      showToast(`Pembayaran ${target.nama_pembayar} berhasil dibatalkan`, 'success');
      setCancelTarget(null);
      load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal membatalkan pembayaran',
        'error'
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const bukaStruk = (r: IuranPembayaran) => {
    const strukData: StrukData = {
      idTransaksi: r.id,
      tipe: 'Iuran',
      namaPembayar: r.nama_pembayar,
      nisPembayar: r.santri_id ? 'Santri' : '-',
      kategoriPembayar: r.tipe_pembayar === 'santri' ? 'Santri' : 'Umum',
      tanggalBayar: r.tanggal_bayar,
      metode: r.metode || 'Tunai',
      items: [
        {
          deskripsi: `${r.iuran_nama}${formatPeriodeRecord(r) !== '—' ? ` (${formatPeriodeRecord(r)})` : ''}`,
          nominal: r.nominal,
        },
      ],
      totalPembayaran: r.nominal,
      keterangan: r.keterangan || '',
    };
    setSavedStrukData(strukData);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!selectedMaster || !isModalOpen) return;
    setNominalStr(formatThousand(selectedMaster.nominal_default));
    if (selectedMaster.jenis_periode === 'bulanan') {
      setPeriodeBulan(currentYearMonth());
    }
    if (selectedMaster.jenis_periode === 'tahunan') {
      setPeriodeTahun(currentYear());
    }
  }, [iuranId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectSantri = (s: Santri) => {
    setSantriId(s.id);
    setNamaPembayar(s.nama);
    setSantriSearch(s.nama);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iuranId) {
      showToast('Pilih program iuran', 'error');
      return;
    }
    if (!namaPembayar.trim()) {
      showToast('Nama pembayar wajib diisi', 'error');
      return;
    }
    if (tipePembayar === 'santri' && !santriId) {
      showToast('Pilih santri dari daftar', 'error');
      return;
    }

    const nominal = parseThousand(nominalStr);
    if (nominal <= 0) {
      showToast('Nominal pembayaran harus lebih dari 0', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const rec = await iuranPembayaranService.catatPembayaran({
        iuran_id: iuranId,
        tipe_pembayar: tipePembayar,
        santri_id: tipePembayar === 'santri' ? santriId : undefined,
        nama_pembayar: namaPembayar.trim(),
        periode_bulan:
          selectedMaster?.jenis_periode === 'bulanan' ? periodeBulan : undefined,
        periode_tahun:
          selectedMaster?.jenis_periode === 'tahunan'
            ? periodeTahun
            : selectedMaster?.jenis_periode === 'bulanan'
              ? parseInt(periodeBulan.split('-')[0], 10)
              : undefined,
        nominal,
        tanggal_bayar: tanggalBayar,
        metode,
        keterangan: keterangan.trim() || undefined,
      });

      const selectedSantriObj = santriList.find((s) => s.id === santriId);
      const strukData: StrukData = {
        idTransaksi: rec.id,
        tipe: 'Iuran',
        namaPembayar: rec.nama_pembayar,
        nisPembayar: selectedSantriObj?.nis || '',
        kategoriPembayar: selectedSantriObj ? `Santri ${selectedSantriObj.kategori}` : 'Umum / Non-Santri',
        tanggalBayar: rec.tanggal_bayar,
        metode: rec.metode || 'Tunai',
        items: [{
          deskripsi: `${rec.iuran_nama}${rec.periode_bulan ? ` (${rec.periode_bulan})` : rec.periode_tahun ? ` (Tahun ${rec.periode_tahun})` : ''}`,
          nominal: rec.nominal,
        }],
        totalPembayaran: rec.nominal,
        keterangan: rec.keterangan,
        santriObj: selectedSantriObj,
      };

      setSavedStrukData(strukData);
      showToast('Pembayaran iuran berhasil dicatat & masuk Kas', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan pembayaran', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalFiltered = filtered.reduce((s, r) => s + (r.nominal || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Iuran</h1>
          <p className="text-sm text-slate-500 mt-1">
            Catat pembayaran program iuran (Haul, dll). Santri maupun non-santri; cicil dengan mencatat ulang.
          </p>
        </div>
        {!isPemilik && (
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Catat Pembayaran
          </button>
        )}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pembayar / program iuran..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]"
            />
          </div>
          <select
            value={filterIuran}
            onChange={(e) => setFilterIuran(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] bg-white cursor-pointer"
          >
            <option value="Semua">Semua Program</option>
            {masterList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nama}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilterIuran('Semua');
            }}
            className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>{filtered.length} transaksi</span>
        <span>
          Total: <strong className="text-slate-800 font-mono">{formatRupiah(totalFiltered)}</strong>
        </span>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="px-4 py-3 font-semibold">Tanggal</th>
                <th className="px-4 py-3 font-semibold">Program</th>
                <th className="px-4 py-3 font-semibold">Pembayar</th>
                <th className="px-4 py-3 font-semibold">Periode</th>
                <th className="px-4 py-3 font-semibold text-right">Nominal</th>
                <th className="px-4 py-3 font-semibold">Metode</th>
                <th className="px-4 py-3 font-semibold">Status Cetak</th>
                <th className="px-4 py-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <HandCoins className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    {isPemilik
                      ? 'Belum ada pembayaran iuran.'
                      : 'Belum ada pembayaran iuran. Klik "Catat Pembayaran" untuk menambah.'}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{r.tanggal_bayar}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.iuran_nama}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.nama_pembayar}</div>
                      <div className="text-[11px] text-slate-400">
                        {r.tipe_pembayar === 'santri' ? 'Santri' : 'Umum'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatPeriodeRecord(r)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                      {formatRupiah(r.nominal)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.metode || '—'}</td>
                    <td className="px-4 py-3">
                      <PrintStatusBadge transaksiId={r.id} compact />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => bukaStruk(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#059669] text-[#059669] hover:bg-[#059669]/10 text-[11px] font-semibold transition-colors cursor-pointer"
                          title="Lihat / Cetak Struk"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Struk</span>
                        </button>
                        {!isPemilik && (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Batalkan transaksi ini"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Batalkan</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <HandCoins className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              Belum ada pembayaran iuran.
            </div>
          ) : (
            filtered.map((r) => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{r.iuran_nama}</p>
                    <p className="text-[11px] text-slate-500">
                      {r.nama_pembayar} • {r.tipe_pembayar === 'santri' ? 'Santri' : 'Umum'}
                    </p>
                  </div>
                  <span className="text-sm font-bold font-mono text-slate-900 whitespace-nowrap">
                    {formatRupiah(r.nominal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 gap-2">
                  <span>
                    {r.tanggal_bayar} • {formatPeriodeRecord(r)}
                  </span>
                  <PrintStatusBadge transaksiId={r.id} compact />
                </div>
                <div className="flex items-center justify-end gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => bukaStruk(r)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#059669] text-[#059669] text-[11px] font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" /> Struk
                  </button>
                  {!isPemilik && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 text-[11px] font-semibold"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Batalkan
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Catat Pembayaran */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-white h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden">
            {savedStrukData ? (
              <StrukPembayaranCard
                data={savedStrukData}
                onClose={() => {
                  setSavedStrukData(null);
                  setIsModalOpen(false);
                }}
                onNewPayment={() => {
                  setSavedStrukData(null);
                  openModal();
                }}
              />
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-slate-50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Catat Pembayaran Iuran</h2>
                <p className="text-xs text-slate-500">
                  Cicil dengan mencatat pembayaran lagi. Total tidak boleh melebihi nominal program.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form id="iuranPaymentForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {masterList.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12px]">
                  Belum ada master iuran aktif. Tambahkan di <strong>Pengaturan → Master Iuran</strong>.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Program Iuran <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={iuranId}
                      onChange={(e) => setIuranId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 bg-white cursor-pointer"
                      required
                    >
                      {masterList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nama} ({labelPeriode(m.jenis_periode)}) — {formatRupiah(m.nominal_default)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Pembayar</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTipePembayar('santri');
                          setNamaPembayar('');
                          setSantriId('');
                          setSantriSearch('');
                        }}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold cursor-pointer ${
                          tipePembayar === 'santri'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" /> Santri
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipePembayar('umum');
                          setSantriId('');
                          setSantriSearch('');
                          setNamaPembayar('');
                        }}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold cursor-pointer ${
                          tipePembayar === 'umum'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" /> Bukan Santri
                      </button>
                    </div>

                    {tipePembayar === 'santri' ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={santriSearch}
                          onChange={(e) => {
                            setSantriSearch(e.target.value);
                            setSantriId('');
                          }}
                          placeholder="Cari nama / NIS santri..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                        />
                        {santriSearch.trim() && (
                          <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-md">
                            {filteredSantri.length === 0 ? (
                              <div className="px-3 py-3 text-slate-400">Tidak ada santri</div>
                            ) : (
                              filteredSantri.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => handleSelectSantri(s)}
                                  className={`w-full text-left p-3 hover:bg-emerald-50 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                    santriId === s.id ? 'bg-emerald-50' : ''
                                  }`}
                                >
                                  <div>
                                    <span className="font-bold text-[#0F172A]">{s.nama}</span>
                                    <span className="text-slate-400 ml-2">({s.nis})</span>
                                  </div>
                                  <div className="font-semibold text-[#059669] px-2 py-0.5 bg-emerald-100 rounded">
                                    {s.kategori}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        {namaPembayar && (
                          <p className="text-[11px] text-emerald-700">
                            Terpilih: <strong>{namaPembayar}</strong>
                          </p>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        required
                        value={namaPembayar}
                        onChange={(e) => setNamaPembayar(e.target.value)}
                        placeholder="Nama lengkap pembayar"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                      />
                    )}
                  </div>

                  {selectedMaster?.jenis_periode === 'bulanan' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> Periode Bulan
                        </span>
                      </label>
                      <input
                        type="month"
                        required
                        value={periodeBulan}
                        onChange={(e) => setPeriodeBulan(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                      />
                    </div>
                  )}

                  {selectedMaster?.jenis_periode === 'tahunan' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> Periode Tahun
                        </span>
                      </label>
                      <input
                        type="number"
                        required
                        min={2000}
                        max={2100}
                        value={periodeTahun}
                        onChange={(e) => setPeriodeTahun(Number(e.target.value) || currentYear())}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nominal (Rp)
                      </label>
                      <input
                        type="text"
                        value={nominalStr}
                        onChange={(e) => setNominalStr(formatThousand(parseThousand(e.target.value)))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-mono"
                        placeholder="0"
                      />
                      <p className="text-[11px] text-slate-400 mt-0.5">Harus lebih dari 0</p>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Tanggal Bayar
                      </label>
                      <input
                        type="date"
                        required
                        value={tanggalBayar}
                        onChange={(e) => setTanggalBayar(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Metode</label>
                    <select
                      value={metode}
                      onChange={(e) => setMetode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 bg-white cursor-pointer"
                    >
                      <option value="Tunai">Tunai</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Keterangan</label>
                    <textarea
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      rows={2}
                      placeholder="Opsional"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 resize-none"
                    />
                  </div>
                </>
              )}

            </form>

            <div className="flex items-center justify-between px-6 py-4 border-t border-[#E2E8F0] bg-slate-50 shrink-0">
              <div>
                <span className="text-xs text-slate-500 block">Total Pembayaran:</span>
                <span className="text-lg font-bold text-[#059669]">
                  {formatRupiah(parseThousand(nominalStr))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg border border-slate-[#CBD5E1] text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="iuranPaymentForm"
                  disabled={isSubmitting || masterList.length === 0}
                  className="px-5 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )}

      {/* Konfirmasi Pembatalan Pembayaran Iuran */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        title="Batalkan Pembayaran Iuran"
        message={`Batalkan pembayaran ${cancelTarget?.nama_pembayar || ''} sebesar ${
          cancelTarget ? formatRupiah(cancelTarget.nominal) : ''
        }?\n\nEntri kas terkait akan dihapus dan status pembayaran direset.`}
        confirmLabel="Ya, Batalkan"
        variant="warning"
        onConfirm={confirmBatalkan}
        onClose={() => {
          if (!isCancelling) setCancelTarget(null);
        }}
      />
    </div>
  );
};

export default IuranListPage;
