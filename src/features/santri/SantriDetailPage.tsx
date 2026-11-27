import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  User,
  Phone,
  Calendar,
  CreditCard,
  History,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Printer,
  HandCoins,
} from 'lucide-react';
import { Santri } from '../../types/santri';
import { SyahriyahTransaksiRecord } from '../../types/syahriyah';
import { KilatanTransaksiRecord } from '../../types/kilatan';
import { IuranPembayaran } from '../../types/iuranPembayaran';
import { santriService } from '../../lib/santriService';
import { syahriyahService } from '../../lib/syahriyahService';
import { kilatanService } from '../../lib/kilatanService';
import { iuranPembayaranService } from '../../lib/iuranPembayaranService';
import { waiverService, labelKeringanan, SyahriyahWaiver } from '../../lib/waiverService';
import { activityLogService, ActivityLogEntry } from '../../lib/activityLogService';
import { buatPayloadToggleStatus } from '../../lib/santriStatus';
import { formatRupiah } from '../../lib/formatter';
import { todayLocal } from '../../lib/core';
import { SantriAvatar } from '../../components/ui/SantriAvatar';
import { SantriFormModal } from './SantriFormModal';
import { StatusToggleConfirmModal } from './StatusToggleConfirmModal';
import { authStore, AuthUser } from '../../store/authStore';
import { showToast } from '../../components/ui/Toast';
import { StrukPembayaranCard, StrukData, StrukItem } from '../../components/ui/StrukPembayaranCard';
import { PrintStatusBadge } from '../../components/ui/PrintStatusBadge';

const BULAN_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
];

type ActiveTab = 'profil' | 'syahriyah' | 'kilatan' | 'iuran' | 'timeline';

function formatPeriodeIuran(r: IuranPembayaran): string {
  if (r.periode_bulan) {
    const [year, month] = r.periode_bulan.split('-').map(Number);
    if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
      return `${BULAN_NAMES[month - 1]} ${year}`;
    }
    return r.periode_bulan;
  }
  if (r.periode_tahun) return String(r.periode_tahun);
  return '—';
}

export const SantriDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  useEffect(() => {
    authStore.getUser().then(setUser);
  }, []);

  const [santri, setSantri] = useState<Santri | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('profil');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [toggleModalOpen, setToggleModalOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [riwayatSyahriyah, setRiwayatSyahriyah] = useState<SyahriyahTransaksiRecord[]>([]);
  const [riwayatKilatan, setRiwayatKilatan] = useState<KilatanTransaksiRecord[]>([]);
  const [riwayatIuran, setRiwayatIuran] = useState<IuranPembayaran[]>([]);
  const [waivers, setWaivers] = useState<SyahriyahWaiver[]>([]);
  const [aktivitasList, setAktivitasList] = useState<ActivityLogEntry[]>([]);
  const [strukData, setStrukData] = useState<StrukData | null>(null);
  const [strukOpen, setStrukOpen] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabContainerRef.current) {
      const scrollAmount = direction === 'left' ? -150 : 150;
      tabContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await santriService.getSantriById(id);
      setSantri(data);
    } catch {
      setSantri(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Riwayat & timeline khusus santri ini, dimuat ulang saat tab dibuka.
  useEffect(() => {
    if (!santri) return;
    let active = true;
    const nama = santri.nama.toLowerCase();
    const nis = santri.nis.toLowerCase();

    Promise.all([
      syahriyahService.getTransaksiList(),
      kilatanService.getTransaksiList(),
      waiverService.getAll(santri.id),
    ])
      .then(([syahriyah, kilatan, daftarKeringanan]) => {
        if (!active) return;
        setWaivers(daftarKeringanan);
        const urut = (a: { transaksi_data?: { tanggal_bayar?: string } }, b: { transaksi_data?: { tanggal_bayar?: string } }) =>
          (b.transaksi_data?.tanggal_bayar || '').localeCompare(a.transaksi_data?.tanggal_bayar || '');

        setRiwayatSyahriyah(
          syahriyah.filter((r) => r.santri_id === santri.id).sort(urut)
        );
        setRiwayatKilatan(
          kilatan.filter((r) => r.santri_id === santri.id).sort(urut)
        );
        setRiwayatIuran(
          iuranPembayaranService
            .getAll()
            .filter((r) => r.santri_id === santri.id)
            .sort((a, b) => (b.tanggal_bayar || '').localeCompare(a.tanggal_bayar || ''))
        );
        setAktivitasList(
          activityLogService
            .getAll()
            .filter((item) => {
              const deskripsi = (item.deskripsi || '').toLowerCase();
              return (
                item.ref_id === santri.id ||
                deskripsi.includes(nama) ||
                (nis.length > 0 && deskripsi.includes(nis))
              );
            })
            .sort((a, b) => (b.waktu || '').localeCompare(a.waktu || ''))
        );
      })
      .catch(() => {
        if (active) showToast('Gagal memuat riwayat santri', 'error');
      });

    return () => {
      active = false;
    };
  }, [santri?.id, activeTab]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatWaktu = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const confirmToggleStatus = async () => {
    if (!santri || isTogglingStatus) return;
    setIsTogglingStatus(true);
    try {
      const { newStatus, payload } = buatPayloadToggleStatus(santri);
      await santriService.updateSantri(santri.id, payload);
      showToast(`Status santri diubah menjadi ${newStatus}`, 'success');
      setToggleModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengubah status santri', 'error');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const lihatStrukSyahriyah = (r: SyahriyahTransaksiRecord) => {
    const items: StrukItem[] = r.items.map((it) => ({
      deskripsi: `Syahriyah ${BULAN_NAMES[it.bulan - 1] || it.bulan} ${it.tahun} (${it.jenis})`,
      nominal: it.nominal,
    }));
    setStrukData({
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
      santriObj: { nama: r.santri_nama, nis: r.santri_nis, kategori: 'Santri' },
    });
    setStrukOpen(true);
  };

  const lihatStrukKilatan = (r: KilatanTransaksiRecord) => {
    const items: StrukItem[] = r.items.map((it) => ({
      deskripsi: `Kilatan ${it.event} ${it.tahun} (${it.jenis})`,
      nominal: it.nominal,
    }));
    setStrukData({
      idTransaksi: r.nomor_kuitansi || r.id,
      tipe: 'Kilatan',
      namaPembayar: r.santri_nama,
      nisPembayar: r.santri_nis || '-',
      kategoriPembayar: 'Santri',
      tanggalBayar: r.transaksi_data?.tanggal_bayar || todayLocal(),
      metode: r.transaksi_data?.metode || 'Tunai',
      items,
      totalPembayaran: r.total_pembayaran,
      keterangan: r.transaksi_data?.keterangan || '',
      rawRecord: r,
      santriObj: { nama: r.santri_nama, nis: r.santri_nis, kategori: 'Santri' },
    });
    setStrukOpen(true);
  };

  const lihatStrukIuran = (r: IuranPembayaran) => {
    const periode = formatPeriodeIuran(r);
    setStrukData({
      idTransaksi: r.id,
      tipe: 'Iuran',
      namaPembayar: r.nama_pembayar,
      nisPembayar: r.santri_id ? 'Santri' : '-',
      kategoriPembayar: r.tipe_pembayar === 'santri' ? 'Santri' : 'Umum',
      tanggalBayar: r.tanggal_bayar || todayLocal(),
      metode: r.metode || 'Tunai',
      items: [{ deskripsi: `${r.iuran_nama}${periode !== '—' ? ` (${periode})` : ''}`, nominal: r.nominal }],
      totalPembayaran: r.nominal,
      keterangan: r.keterangan || '',
      rawRecord: r,
      santriObj: { nama: santri?.nama || r.nama_pembayar, nis: santri?.nis || '', kategori: 'Santri' },
    });
    setStrukOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-4 max-w-4xl mx-auto">
        <div className="animate-pulse h-6 bg-slate-200 rounded w-1/4" />
        <div className="animate-pulse h-28 bg-slate-200 rounded-2xl" />
        <div className="animate-pulse h-60 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (!santri) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs max-w-lg mx-auto my-8">
        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
        <h2 className="text-xl font-bold text-[#0F172A] mb-1">Santri Tidak Ditemukan</h2>
        <p className="text-sm text-slate-500 mb-6">
          Data santri yang Anda cari tidak ada atau telah dihapus.
        </p>
        <button
          onClick={() => navigate('/santri')}
          className="px-4 py-2 bg-[#059669] text-white text-sm font-semibold rounded-lg hover:bg-[#047857] transition-colors"
        >
          Kembali ke Data Santri
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-12">
      {/* Top Header Row with Kembali and Compact Edit */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali</span>
        </button>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-xs"
            >
              <Edit className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Santri</span>
            </button>
            <button
              onClick={() => setToggleModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors shadow-xs ${
                santri?.status === 'Aktif'
                  ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {santri?.status === 'Aktif' ? (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  <span>Nonaktifkan</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Aktifkan Kembali</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Profile Card Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-xs flex items-center gap-4 sm:gap-6">
        <SantriAvatar
          nama={santri.nama}
          foto={santri.foto}
          className="w-14 h-14 sm:w-16 sm:h-16"
          textClassName="text-lg sm:text-xl"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-lg sm:text-2xl font-bold text-[#0F172A] tracking-tight truncate">
              {santri.nama}
            </h1>
            <span className="text-xs font-mono text-slate-400">NIS: {santri.nis}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {santri.kategori === 'Mukim' && (
              <span className="px-2 py-0.5 rounded-md font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Mukim
              </span>
            )}
            {santri.kategori === 'Nduduk' && (
              <span className="px-2 py-0.5 rounded-md font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Nduduk
              </span>
            )}
            {santri.kategori === 'Kilatan' && (
              <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Kilatan
              </span>
            )}
            
            {santri.status === 'Aktif' ? (
              <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Aktif
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md font-semibold bg-red-50 text-red-700 border border-red-200">
                Tidak Aktif
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Inline Symmetrical Tab Header Navigation */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 w-full border-b border-slate-200 group">
        <button
          type="button"
          onClick={() => scrollTabs('left')}
          aria-label="Scroll Tabs Left"
          className="p-1 sm:p-1.5 rounded-full border border-slate-200 bg-white shadow-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all opacity-40 group-hover:opacity-100 shrink-0 mb-1"
          title="Scroll Kiri"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div
          ref={tabContainerRef}
          className="flex items-center gap-4 sm:gap-6 overflow-x-auto text-sm font-medium whitespace-nowrap no-scrollbar [&::-webkit-scrollbar]:hidden [scrollbar-width:none] flex-1 px-2 scroll-smooth"
        >
          {[
            { key: 'profil', label: 'Profil Lengkap', icon: User },
            { key: 'syahriyah', label: 'Riwayat Syahriyah', icon: CreditCard },
            { key: 'kilatan', label: 'Riwayat Kilatan', icon: History },
            { key: 'iuran', label: 'Riwayat Iuran', icon: HandCoins },
            { key: 'timeline', label: 'Timeline', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as ActiveTab)}
                className={`pb-3 inline-flex items-center gap-2 transition-colors border-b-2 font-semibold whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-[#059669] text-[#059669]'
                    : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => scrollTabs('right')}
          aria-label="Scroll Tabs Right"
          className="p-1 sm:p-1.5 rounded-full border border-slate-200 bg-white shadow-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all opacity-40 group-hover:opacity-100 shrink-0 mb-1"
          title="Scroll Kanan"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-1">
        {activeTab === 'profil' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-xs space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                <h3 className="font-bold text-[#0F172A] text-base border-b border-slate-100 pb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#059669]" />
                  Informasi Santri
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Nama Lengkap</span>
                    <span className="text-[#0F172A] font-semibold text-sm">{santri.nama}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Nomor Induk Santri (NIS)</span>
                    <span className="text-[#0F172A] font-mono font-semibold">{santri.nis}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">No. HP Santri</span>
                    <span className="text-[#0F172A] font-medium flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {santri.no_hp_santri}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-bold text-[#0F172A] text-base border-b border-slate-100 pb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#059669]" />
                  Informasi Wali & Pendaftaran
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Nama Wali</span>
                    <span className="text-[#0F172A] font-semibold text-sm">{santri.nama_wali}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">No. HP Wali</span>
                    <span className="text-[#0F172A] font-medium flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {santri.no_hp_wali}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Tanggal Terdaftar</span>
                    <span className="text-[#0F172A] font-medium flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(santri.tanggal_masuk)}
                    </span>
                  </div>
                  {santri.status === 'Tidak Aktif' && santri.tanggal_keluar && (
                    <div>
                      <span className="text-slate-400 block font-medium">Tanggal Keluar</span>
                      <span className="text-[#0F172A] font-medium flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(santri.tanggal_keluar)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Riwayat Status */}
            {(santri.periode_nonaktif?.length || 0) > 0 && (
              <div>
                <h3 className="font-bold text-[#0F172A] text-base border-b border-slate-100 pb-2 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#059669]" />
                  Riwayat Status
                </h3>
                <div className="mt-2 space-y-1.5">
                  {(santri.periode_nonaktif || []).map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <UserX className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-slate-700 font-medium">
                        Tidak aktif: {formatDate(p.mulai)} →{' '}
                        {p.sampai ? formatDate(p.sampai) : 'masih tidak aktif'}
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-500">
                    Bulan di sela periode tidak aktif tidak ditagih; bulan penonaktifan dan
                    pengaktifan kembali tetap ditagih.
                  </p>
                </div>
              </div>
            )}

            {santri.catatan && (
              <div className="border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-400 font-medium block mb-1">Catatan Khusus</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {santri.catatan}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'syahriyah' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#E2E8F0] bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">Riwayat Pembayaran Syahriyah</h3>
                <p className="text-[11px] text-slate-500">
                  {riwayatSyahriyah.length} transaksi · total{' '}
                  {formatRupiah(riwayatSyahriyah.reduce((sum, r) => sum + (r.total_pembayaran || 0), 0))}
                </p>
                {waivers.length > 0 && (
                  <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
                    {labelKeringanan(waivers[0])} · {waivers[0].bulan_mulai}–{waivers[0].bulan_selesai}/{waivers[0].tahun}
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate('/syahriyah')}
                className="self-start px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-white"
              >
                Buka Menu Syahriyah
              </button>
            </div>
            {riwayatSyahriyah.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Belum ada pembayaran syahriyah untuk santri ini.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {riwayatSyahriyah.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {formatDate(r.transaksi_data?.tanggal_bayar || '')} · {r.nomor_kuitansi || r.id}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {r.items.map((it) => `${BULAN_NAMES[it.bulan - 1] || it.bulan}${it.jenis === 'Sebagian' ? '*' : ''}`).join(', ')}
                      </p>
                    </div>
                    <span className="text-sm font-semibold font-mono text-emerald-700 whitespace-nowrap">
                      {formatRupiah(r.total_pembayaran)}
                    </span>
                    <div className="flex items-center gap-2">
                      <PrintStatusBadge transaksiId={r.id} compact />
                      <button
                        type="button"
                        onClick={() => lihatStrukSyahriyah(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-50"
                      >
                        <Printer className="w-3 h-3" /> Struk
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'kilatan' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#E2E8F0] bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">Riwayat Pembayaran Kilatan</h3>
                <p className="text-[11px] text-slate-500">
                  {riwayatKilatan.length} transaksi · total{' '}
                  {formatRupiah(riwayatKilatan.reduce((sum, r) => sum + (r.total_pembayaran || 0), 0))}
                </p>
              </div>
              <button
                onClick={() => navigate('/kilatan')}
                className="self-start px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-white"
              >
                Buka Menu Kilatan
              </button>
            </div>
            {riwayatKilatan.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Belum ada pembayaran kilatan untuk santri ini.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {riwayatKilatan.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {formatDate(r.transaksi_data?.tanggal_bayar || '')} · {r.nomor_kuitansi || r.id}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {r.items.map((it) => `${it.event} ${it.tahun}${it.jenis === 'Sebagian' ? '*' : ''}`).join(', ')}
                      </p>
                    </div>
                    <span className="text-sm font-semibold font-mono text-emerald-700 whitespace-nowrap">
                      {formatRupiah(r.total_pembayaran)}
                    </span>
                    <div className="flex items-center gap-2">
                      <PrintStatusBadge transaksiId={r.id} compact />
                      <button
                        type="button"
                        onClick={() => lihatStrukKilatan(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-50"
                      >
                        <Printer className="w-3 h-3" /> Struk
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'iuran' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#E2E8F0] bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">Riwayat Pembayaran Iuran</h3>
                <p className="text-[11px] text-slate-500">
                  {riwayatIuran.length} transaksi · total{' '}
                  {formatRupiah(riwayatIuran.reduce((sum, r) => sum + (r.nominal || 0), 0))}
                </p>
              </div>
              <button
                onClick={() => navigate('/iuran')}
                className="self-start px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-white"
              >
                Buka Menu Iuran
              </button>
            </div>
            {riwayatIuran.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <HandCoins className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Belum ada pembayaran iuran untuk santri ini.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {riwayatIuran.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {formatDate(r.tanggal_bayar)} · {r.iuran_nama}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {r.nama_pembayar} · {formatPeriodeIuran(r)} · {r.metode || 'Tunai'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold font-mono text-emerald-700 whitespace-nowrap">
                      {formatRupiah(r.nominal)}
                    </span>
                    <div className="flex items-center gap-2">
                      <PrintStatusBadge transaksiId={r.id} compact />
                      <button
                        type="button"
                        onClick={() => lihatStrukIuran(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-50"
                      >
                        <Printer className="w-3 h-3" /> Struk
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50">
              <h3 className="text-sm font-semibold text-[#0F172A]">Timeline Aktivitas</h3>
              <p className="text-[11px] text-slate-500">{aktivitasList.length} aktivitas terkait santri ini</p>
            </div>
            {aktivitasList.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Belum ada aktivitas untuk santri ini.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {aktivitasList.map((item) => (
                  <li key={item.id} className="px-4 py-3 flex gap-3">
                    <div className="mt-1 w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {item.modul}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.aksi === 'Hapus' || item.aksi === 'Pembatalan'
                            ? 'bg-red-50 text-red-700'
                            : item.aksi === 'Pembayaran'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {item.aksi}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatWaktu(item.waktu)}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{item.deskripsi}</p>
                      {item.user && <p className="text-[11px] text-slate-400">Oleh: {item.user}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Modal Edit */}
      {isAdmin && santri && (
        <SantriFormModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          santriId={santri.id}
          onSuccess={loadData}
        />
      )}

      {/* Modal Konfirmasi Ubah Status */}
      {isAdmin && santri && (
        <StatusToggleConfirmModal
          santri={toggleModalOpen ? santri : null}
          isLoading={isTogglingStatus}
          onConfirm={confirmToggleStatus}
          onClose={() => setToggleModalOpen(false)}
        />
      )}

      {/* Modal Struk dari riwayat */}
      {strukOpen && strukData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setStrukOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl shadow-2xl z-10 overflow-hidden">
            <StrukPembayaranCard
              data={strukData}
              onClose={() => setStrukOpen(false)}
              onNewPayment={() => setStrukOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SantriDetailPage;
