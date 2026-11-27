import { storage } from '../../lib/storage';
import { todayLocal, currentYmLocal, nextYm } from '../../lib/core';
import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  DollarSign,
  Users,
  Save,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Shield,
  UserCheck,
  UserX,
  Layers,
  FileText,
  Database,
  Download,
  Upload,
  Palette,
  ChevronLeft,
  ChevronRight,
  User,
  MapPin,
  Phone,
  Mail,
  Camera,
  X,
  Home,
  Sparkles,
  Calendar,
  Archive,
  Clock,
  Edit2,
  AlertTriangle,
  FolderOpen,
  Printer,
  ReceiptText,
  Eye,
} from 'lucide-react';
import {
  ProfilPondok,
  TarifDefault,
  ArsipTarif,
  StatusTarifRiwayat,
  UserAccount,
  UserRole,
  MasterIuran,
  JenisPeriodeIuran,
  StatusMasterIuran,
} from '../../types/pengaturan';
import {
  pengaturanService,
  masterIuranService,
  DEFAULT_PROFIL,
  DEFAULT_TARIF,
  DEFAULT_ARSIP_TARIF,
} from '../../lib/pengaturanService';
import { getSyahriyahMonthsWithPayments, applyNewTarifToMonths, getTarifSyahriyah } from '../../lib/syahriyahService';
import { getKilatanMonthsWithPayments, applyNewKilatanTarifToUnpaid, getTarifKilatanForEvent } from '../../lib/kilatanService';
import { santriService } from '../../lib/santriService';
import { Santri } from '../../types/santri';
import { kasService } from '../../lib/kasService';
import { UserFormModal } from './UserFormModal';
import { KopSuratTab } from '../kopSurat/KopSuratTab';
import { KwitansiTab } from '../kopSurat/KwitansiTab';
import { showToast } from '../../components/ui/Toast';
import { showUndoToast } from '../../components/ui/UndoToast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { authStore, AuthUser } from '../../store/authStore';
import { formatRupiah } from '../../lib/formatter';
import { buildBackup, restoreBackup } from '../../lib/backupService';
import { iuranPembayaranService } from '../../lib/iuranPembayaranService';
import { waiverService, hitungPotongan } from '../../lib/waiverService';
import { isApiMode } from '../../lib/apiClient';
import { unduhBackupApi, pulihkanBackupApi } from '../../lib/apiBackup';
import {
  getKategoriKas,
  saveKategoriKas,
  type KategoriKasConfig,
} from '../../lib/kategoriKas';

type ActiveTab =
  | 'profil'
  | 'tarif'
  | 'users'
  | 'iuran'
  | 'master_iuran'
  | 'kategori_kas'
  | 'kopdesain'
  | 'kwitansi'
  | 'backup'
  ;

interface IuranTambahanItem {
  id: string;
  nama: string;
  tipe: 'Syahriyah' | 'Kilatan' | 'Keduanya';
  nominal: number;
}

const STORAGE_KEY_IURAN = 'al_hidayah_iuran_tambahan';

const DEFAULT_IURAN: IuranTambahanItem[] = [
  { id: 'iur-1', nama: 'Seragam', tipe: 'Keduanya', nominal: 50000 },
  { id: 'iur-2', nama: 'Kitab', tipe: 'Syahriyah', nominal: 35000 },
];

export const PengaturanPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [profil, setProfil] = useState<ProfilPondok>(DEFAULT_PROFIL);
  const [profilForm, setProfilForm] = useState<ProfilPondok>(DEFAULT_PROFIL);
  const [tarif, setTarif] = useState<TarifDefault>(DEFAULT_TARIF);
  const [arsipTarifList, setArsipTarifList] = useState<ArsipTarif[]>(DEFAULT_ARSIP_TARIF);
  const [tarifForm, setTarifForm] = useState<TarifDefault>(DEFAULT_TARIF);
  const [users, setUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    let mounted = true;
    authStore.getUser().then((u) => { if (mounted) setCurrentUser(u); });
    pengaturanService.getProfil().then((p) => { if (mounted) { setProfil(p); setProfilForm(p); } });
    pengaturanService.getTarif().then((t) => { if (mounted) { setTarif(t); setTarifForm(t); } });
    pengaturanService.getArsipTarif().then((a) => { if (mounted) setArsipTarifList(a); });
    pengaturanService.getUsers().then((us) => { if (mounted) setUsers(us); });
    return () => { mounted = false; };
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('profil');
  // Dialog konfirmasi generik (pengganti window.confirm)
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabContainerRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      tabContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Profil State & Modal
  const [isProfilModalOpen, setIsProfilModalOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleOpenProfilModal = () => {
    setProfilForm({ ...profil });
    setIsProfilModalOpen(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Hanya file gambar (PNG, JPG, WebP) yang diperbolehkan', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setProfilForm((prev) => ({ ...prev, logo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setProfilForm((prev) => ({ ...prev, logo: '' }));
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleSaveProfilModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilForm.nama_pondok.trim()) {
      showToast('Nama pondok pesantren wajib diisi', 'error');
      return;
    }
    pengaturanService.saveProfil(profilForm);
    setProfil(profilForm);
    setIsProfilModalOpen(false);
    showToast('Profil pondok berhasil disimpan!');
  };

  // Tarif & Arsip State
  const [isTarifModalOpen, setIsTarifModalOpen] = useState(false);
  const [isTarifErrorOpen, setIsTarifErrorOpen] = useState(false);
  const [tarifErrorPeriod, setTarifErrorPeriod] = useState('');
  const [tarifErrorMonths, setTarifErrorMonths] = useState<string[]>([]);

  // Users Table State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // TAB 4: Iuran Tambahan State
  const [iuranList, setIuranList] = useState<IuranTambahanItem[]>(() => {
    try {
      const raw = storage.getItem(STORAGE_KEY_IURAN);
      if (!raw) {
        storage.setItem(STORAGE_KEY_IURAN, JSON.stringify(DEFAULT_IURAN));
        return DEFAULT_IURAN;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_IURAN;
    }
  });
  const [isIuranModalOpen, setIsIuranModalOpen] = useState(false);
  const [editingIuran, setEditingIuran] = useState<IuranTambahanItem | null>(null);
  const [iuranForm, setIuranForm] = useState<{
    nama: string;
    tipe: 'Syahriyah' | 'Kilatan' | 'Keduanya';
    nominal: number;
  }>({ nama: '', tipe: 'Keduanya', nominal: 0 });

  // TAB: Master Iuran (Haul, program iuran, dll.)
  const [masterIuranList, setMasterIuranList] = useState<MasterIuran[]>([]);
  const [isMasterIuranModalOpen, setIsMasterIuranModalOpen] = useState(false);
  const [editingMasterIuran, setEditingMasterIuran] = useState<MasterIuran | null>(null);
  const [masterIuranForm, setMasterIuranForm] = useState<{
    nama: string;
    nominal_default: number;
    jenis_periode: JenisPeriodeIuran;
    status: StatusMasterIuran;
    keterangan: string;
  }>({
    nama: '',
    nominal_default: 0,
    jenis_periode: 'tahunan',
    status: 'Aktif',
    keterangan: '',
  });

  // TAB 5: Kategori Kas State
  const [kategoriKas, setKategoriKas] = useState<KategoriKasConfig>(() => getKategoriKas());
  const [newKatPemasukan, setNewKatPemasukan] = useState('');
  const [newKatPengeluaran, setNewKatPengeluaran] = useState('');
  const [katCounts, setKatCounts] = useState<Record<string, number>>({});

  // Kategori Kas Modal States
  const [isEditKatModalOpen, setIsEditKatModalOpen] = useState(false);
  const [editKatType, setEditKatType] = useState<'pemasukan' | 'pengeluaran'>('pemasukan');
  const [editKatOldName, setEditKatOldName] = useState('');
  const [editKatNewName, setEditKatNewName] = useState('');

  const [isDeleteKatModalOpen, setIsDeleteKatModalOpen] = useState(false);
  const [deleteKatType, setDeleteKatType] = useState<'pemasukan' | 'pengeluaran'>('pemasukan');
  const [deleteKatTargetName, setDeleteKatTargetName] = useState('');

  // Hitung jumlah transaksi per kategori (dipakai render daftar kategori)
  useEffect(() => {
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      for (const cat of kategoriKas.pemasukan) {
        counts[`pemasukan|${cat}`] = await kasService.countKasByKategori(cat, 'pemasukan');
      }
      for (const cat of kategoriKas.pengeluaran) {
        counts[`pengeluaran|${cat}`] = await kasService.countKasByKategori(cat, 'pengeluaran');
      }
      setKatCounts(counts);
    };
    loadCounts();
  }, [kategoriKas]);

  // TAB 6: Desain Kwitansi State — dikelola di komponen KwitansiTab


  const BULAN_FULL_NAMES = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  const formatPeriodeBulan = (ym?: string): string => {
    if (!ym || !ym.includes('-')) return '-';
    const [yearStr, monthStr] = ym.split('-');
    const monthIdx = parseInt(monthStr, 10) - 1;
    const monthName = BULAN_FULL_NAMES[monthIdx] || monthStr;
    return `${monthName} ${yearStr}`;
  };

  const formatPeriodeRange = (
    mulai?: string,
    selesai?: string,
    opts?: { ongoingLabel?: string }
  ): string => {
    const ongoing = opts?.ongoingLabel ?? 'Sekarang';
    if (!mulai && !selesai) return '-';
    if (mulai && selesai) {
      if (selesai < mulai) {
        return `${formatPeriodeBulan(mulai)} (periode tidak valid)`;
      }
      if (mulai === selesai) {
        return formatPeriodeBulan(mulai);
      }
      return `${formatPeriodeBulan(mulai)} – ${formatPeriodeBulan(selesai)}`;
    }
    if (mulai && !selesai) {
      return `${formatPeriodeBulan(mulai)} – ${ongoing}`;
    }
    return `Hingga ${formatPeriodeBulan(selesai)}`;
  };

  /** Bandingkan YYYY-MM */
  const compareYM = (a: string, b: string): number => a.localeCompare(b);

  type TarifTableRow = {
    id: string;
    periode_mulai: string;
    periode_selesai?: string;
    syahriyah_mukim: number;
    syahriyah_nduduk: number;
    syahriyah_kilatan: number;
    event_kilatan: number;
    status: StatusTarifRiwayat;
  };

  /** Gabungan: Dijadwalkan + Aktif + Diarsipkan, urut periode_mulai desc */
  const buildTarifTableRows = (): TarifTableRow[] => {
    const nowYM = currentYmLocal();
    const scheduled = arsipTarifList.filter((a) => a.status === 'Dijadwalkan');
    const archived = arsipTarifList.filter((a) => a.status === 'Diarsipkan');

    const activeStart = tarif.periode_mulai || `${new Date().getFullYear()}-01`;
    // Akhir aktif = H-1 dari scheduled terdekat di masa depan, atau kosong (Sekarang)
    const futureScheduled = scheduled
      .filter((s) => compareYM(s.periode_mulai, nowYM) > 0)
      .sort((a, b) => compareYM(a.periode_mulai, b.periode_mulai));
    let activeEnd: string | undefined;
    if (futureScheduled.length > 0) {
      const prev = getPreviousMonth(futureScheduled[0].periode_mulai);
      activeEnd = prev && compareYM(prev, activeStart) >= 0 ? prev : undefined;
    }

    const activeRow: TarifTableRow = {
      id: 'row-aktif',
      periode_mulai: activeStart,
      periode_selesai: activeEnd,
      syahriyah_mukim: tarif.syahriyah_mukim,
      syahriyah_nduduk: tarif.syahriyah_nduduk,
      syahriyah_kilatan: tarif.syahriyah_kilatan,
      event_kilatan: tarif.event_kilatan,
      status: 'Aktif',
    };

    const rows: TarifTableRow[] = [
      ...scheduled.map((s) => ({
        id: s.id,
        periode_mulai: s.periode_mulai,
        periode_selesai: s.periode_selesai,
        syahriyah_mukim: s.syahriyah_mukim,
        syahriyah_nduduk: s.syahriyah_nduduk,
        syahriyah_kilatan: s.syahriyah_kilatan,
        event_kilatan: s.event_kilatan,
        status: 'Dijadwalkan' as const,
      })),
      activeRow,
      ...archived.map((s) => ({
        id: s.id,
        periode_mulai: s.periode_mulai,
        periode_selesai: s.periode_selesai,
        syahriyah_mukim: s.syahriyah_mukim,
        syahriyah_nduduk: s.syahriyah_nduduk,
        syahriyah_kilatan: s.syahriyah_kilatan,
        event_kilatan: s.event_kilatan,
        status: 'Diarsipkan' as const,
      })),
    ];

    return rows.sort((a, b) => compareYM(b.periode_mulai, a.periode_mulai));
  };

  const getPreviousMonth = (ym: string): string => {
    if (!ym || !ym.includes('-')) return '';
    const [yearStr, monthStr] = ym.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  // Toast memakai showToast global dari components/ui/Toast

  const loadAllData = async () => {
    const p = await pengaturanService.getProfil();
    setProfil(p);
    setProfilForm(p);
    const t = await pengaturanService.getTarif();
    setTarif(t);
    const a = await pengaturanService.getArsipTarif();
    setArsipTarifList(a);
    const us = await pengaturanService.getUsers();
    setUsers(us);
    setMasterIuranList(await masterIuranService.getAll());
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handlers Tarif Aktif & Modal
  const handleOpenTarifModal = () => {
    setTarifForm({
      ...tarif,
      periode_mulai: nextYm(currentYmLocal()),
    });
    setIsTarifModalOpen(true);
  };

  const handleSaveTarifModal = async (e: React.FormEvent) => {
    e.preventDefault();

    const nowYM = currentYmLocal();
    const newPeriod = tarifForm.periode_mulai?.trim() || nextYm(nowYM);
    if (!/^\d{4}-\d{2}$/.test(newPeriod)) {
      showToast('Periode mulai tarif tidak valid.', 'error');
      return;
    }
    // Tarif tidak boleh berlaku mundur ke masa lalu.
    if (compareYM(newPeriod, nowYM) < 0) {
      showToast('Periode mulai tarif tidak boleh di masa lalu.', 'error');
      return;
    }
    const oldStartPeriod = tarif.periode_mulai || `${new Date().getFullYear()}-01`;
    const oldEndPeriod = getPreviousMonth(newPeriod) || oldStartPeriod;

    const newAmounts = {
      syahriyah_mukim: Number(tarifForm.syahriyah_mukim) || 0,
      syahriyah_nduduk: Number(tarifForm.syahriyah_nduduk) || 0,
      syahriyah_kilatan: 0, // tidak dipakai
      event_kilatan: Number(tarifForm.event_kilatan) || 0,
    };

    // Validasi pembayaran di periode baru
    const paidSyahriyah = getSyahriyahMonthsWithPayments();
    const paidKilatan = getKilatanMonthsWithPayments();
    const allPaidMonths = Array.from(new Set([...paidSyahriyah, ...paidKilatan])).sort();
    // Sesuai PRD: perubahan ditolak bila bulan efektif sudah ada pembayaran.
    // Pembayaran di bulan lain tidak terpengaruh karena nominalnya sudah terkunci.
    if (allPaidMonths.includes(newPeriod)) {
      showToast(
        `Bulan ${formatPeriodeBulan(newPeriod)} sudah ada pembayaran, sehingga tarif tidak dapat berlaku mulai bulan itu. Pilih bulan lain.`,
        'error'
      );
      return;
    }

    const isFuture = compareYM(newPeriod, nowYM) > 0;

    // --- Tarif dijadwalkan (masa depan) ---
    if (isFuture) {
      // Hapus jadwal lama, ganti dengan yang baru
      const withoutOldSchedule = arsipTarifList.filter((a) => a.status !== 'Dijadwalkan');
      const scheduled: ArsipTarif = {
        id: 'jadwal-' + Date.now(),
        periode_mulai: newPeriod,
        periode_selesai: undefined,
        ...newAmounts,
        status: 'Dijadwalkan',
        diarsipkan_pada: new Date().toISOString(),
      };
      const updated = [scheduled, ...withoutOldSchedule];
      setArsipTarifList(updated);
      pengaturanService.saveArsipTarif(updated);
      setIsTarifModalOpen(false);
      showToast(
        `Tarif dijadwalkan mulai ${formatPeriodeBulan(newPeriod)}. Tarif aktif saat ini tetap berlaku.`,
        'success'
      );
      return;
    }

    // --- Tarif berlaku sekarang / segera ---
    // Periode baru harus setelah mulai tarif aktif (kecuali update nominal di periode sama)
    const isSameStart = compareYM(newPeriod, oldStartPeriod) === 0;
    if (!isSameStart && compareYM(newPeriod, oldStartPeriod) < 0) {
      showToast(
        'Periode mulai baru tidak boleh sebelum periode tarif aktif saat ini.',
        'error'
      );
      return;
    }

    let nextArsip = arsipTarifList.filter((a) => a.status !== 'Dijadwalkan');

    // Arsipkan tarif aktif lama jika periode mulai berbeda
    if (!isSameStart) {
      if (compareYM(oldEndPeriod, oldStartPeriod) < 0) {
        showToast(
          'Rentang periode arsip tidak valid. Periksa periode mulai tarif baru.',
          'error'
        );
        return;
      }
      const archived: ArsipTarif = {
        id: 'arsip-' + Date.now(),
        periode_mulai: oldStartPeriod,
        periode_selesai: oldEndPeriod,
        syahriyah_mukim: Number(tarif.syahriyah_mukim) || 0,
        syahriyah_nduduk: Number(tarif.syahriyah_nduduk) || 0,
        syahriyah_kilatan: 0,
        event_kilatan: Number(tarif.event_kilatan) || 0,
        status: 'Diarsipkan',
        diarsipkan_pada: new Date().toISOString(),
      };
      nextArsip = [archived, ...nextArsip];
    }

    setArsipTarifList(nextArsip);
    pengaturanService.saveArsipTarif(nextArsip);

    const updatedTarif: TarifDefault = {
      ...newAmounts,
      periode_mulai: newPeriod,
    };
    setTarif(updatedTarif);
    pengaturanService.saveTarif(updatedTarif);

    const waivers = await waiverService.getAll();
    const penyesuaian = await applyNewTarifToMonths(
      newPeriod,
      getTarifSyahriyah,
      async (santriId, tahun, bulan, kategori) => {
        const w = waivers.find(
          (item) =>
            item.santri_id === santriId &&
            item.tahun === tahun &&
            item.bulan_mulai <= bulan &&
            item.bulan_selesai >= bulan
        );
        if (!w) return 0;
        const tarif = await getTarifSyahriyah(kategori, tahun, bulan);
        return hitungPotongan(w.jenis, w.nominal_per_bulan, tarif);
      }
    );
    await applyNewKilatanTarifToUnpaid(newPeriod, (tahun, event) =>
      getTarifKilatanForEvent(tahun, event)
    );

    setIsTarifModalOpen(false);
    showToast(
      isSameStart
        ? `Tarif aktif diperbarui (${penyesuaian.diubah} bulan disesuaikan).`
        : `Tarif baru aktif. ${penyesuaian.diubah} bulan disesuaikan.${
            penyesuaian.kelebihanBayar ? ` ${penyesuaian.kelebihanBayar} bulan kelebihan bayar.` : ''
          }`,
      'success'
    );
  };

  // User Actions
  const handleAddUser = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = (user: UserAccount) => {
    if (currentUser && currentUser.username === user.username) {
      showToast('Anda tidak dapat menghapus akun Anda sendiri!', 'error');
      return;
    }

    setConfirmState({
      title: 'Hapus Akun User',
      message: `Apakah Anda yakin ingin menghapus akun user "${user.nama}" (${user.username})?`,
      confirmLabel: 'Hapus',
      variant: 'danger',
      onConfirm: () => {
        pengaturanService.deleteUser(user.id);
        loadAllData();
        showToast(`User "${user.nama}" telah dihapus.`);
        setConfirmState(null);
      },
    });
  };

  // Iuran Tambahan Handlers
  const handleSaveIuran = (e: React.FormEvent) => {
    e.preventDefault();
    if (!iuranForm.nama.trim()) {
      showToast('Nama iuran wajib diisi', 'error');
      return;
    }

    let updated: IuranTambahanItem[];
    if (editingIuran) {
      updated = iuranList.map((item) =>
        item.id === editingIuran.id ? { ...item, ...iuranForm } : item
      );
      showToast('Iuran tambahan berhasil diperbarui');
    } else {
      const newItem: IuranTambahanItem = {
        id: 'iur-' + Date.now(),
        ...iuranForm,
      };
      updated = [...iuranList, newItem];
      showToast('Iuran tambahan berhasil ditambahkan');
    }

    setIuranList(updated);
    void iuranPembayaranService.saveIuranTambahan(updated);
    setIsIuranModalOpen(false);
  };

  const handleDeleteIuran = (id: string) => {
    setConfirmState({
      title: 'Hapus Iuran Tambahan',
      message: 'Yakin ingin menghapus iuran tambahan ini?',
      confirmLabel: 'Hapus',
      variant: 'danger',
      onConfirm: () => {
        const updated = iuranList.filter((i) => i.id !== id);
        setIuranList(updated);
        void iuranPembayaranService.saveIuranTambahan(updated);
        showToast('Iuran tambahan berhasil dihapus');
        setConfirmState(null);
      },
    });
  };

  // ── Master Iuran handlers ──────────────────────────────────────────────
  const openCreateMasterIuran = () => {
    setEditingMasterIuran(null);
    setMasterIuranForm({
      nama: '',
      nominal_default: 0,
      jenis_periode: 'tahunan',
      status: 'Aktif',
      keterangan: '',
    });
    setIsMasterIuranModalOpen(true);
  };

  const openEditMasterIuran = (item: MasterIuran) => {
    setEditingMasterIuran(item);
    setMasterIuranForm({
      nama: item.nama,
      nominal_default: item.nominal_default,
      jenis_periode: item.jenis_periode,
      status: item.status,
      keterangan: item.keterangan || '',
    });
    setIsMasterIuranModalOpen(true);
  };

  const handleSaveMasterIuran = async (e: React.FormEvent) => {
    e.preventDefault();
    const nama = masterIuranForm.nama.trim();
    if (!nama) {
      showToast('Nama iuran wajib diisi', 'error');
      return;
    }
    if (editingMasterIuran) {
      await masterIuranService.update(editingMasterIuran.id, {
        nama,
        nominal_default: Number(masterIuranForm.nominal_default) || 0,
        jenis_periode: masterIuranForm.jenis_periode,
        status: masterIuranForm.status,
        keterangan: masterIuranForm.keterangan.trim() || undefined,
      });
      showToast('Master iuran berhasil diperbarui');
    } else {
      await masterIuranService.create({
        nama,
        nominal_default: Number(masterIuranForm.nominal_default) || 0,
        jenis_periode: masterIuranForm.jenis_periode,
        status: masterIuranForm.status,
        keterangan: masterIuranForm.keterangan.trim() || undefined,
      });
      showToast('Master iuran berhasil ditambahkan');
    }
    setMasterIuranList(await masterIuranService.getAll());
    setIsMasterIuranModalOpen(false);
  };

  const handleDeleteMasterIuran = (id: string) => {
    setConfirmState({
      title: 'Hapus Master Iuran',
      message: 'Hapus master iuran ini? Data tidak dapat dikembalikan.',
      confirmLabel: 'Hapus',
      variant: 'danger',
      onConfirm: async () => {
        await masterIuranService.remove(id);
        setMasterIuranList(await masterIuranService.getAll());
        showToast('Master iuran dihapus');
        setConfirmState(null);
      },
    });
  };

  const labelPeriodeIuran = (j: JenisPeriodeIuran) => {
    if (j === 'sekali') return 'Sekali';
    if (j === 'bulanan') return 'Bulanan';
    return 'Tahunan';
  };
;

  // Kategori Kas Handlers
  const handleAddKatPemasukan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKatPemasukan.trim()) return;
    if (kategoriKas.pemasukan.includes(newKatPemasukan.trim())) {
      showToast('Kategori sudah ada', 'error');
      return;
    }
    const updated = {
      ...kategoriKas,
      pemasukan: [...kategoriKas.pemasukan, newKatPemasukan.trim()],
    };
    setKategoriKas(updated);
    saveKategoriKas(updated);
    setNewKatPemasukan('');
    showToast('Kategori pemasukan ditambahkan');
  };

  const handleAddKatPengeluaran = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKatPengeluaran.trim()) return;
    if (kategoriKas.pengeluaran.includes(newKatPengeluaran.trim())) {
      showToast('Kategori sudah ada', 'error');
      return;
    }
    const updated = {
      ...kategoriKas,
      pengeluaran: [...kategoriKas.pengeluaran, newKatPengeluaran.trim()],
    };
    setKategoriKas(updated);
    saveKategoriKas(updated);
    setNewKatPengeluaran('');
    showToast('Kategori pengeluaran ditambahkan');
  };

  const handleOpenEditKat = (name: string, type: 'pemasukan' | 'pengeluaran') => {
    setEditKatType(type);
    setEditKatOldName(name);
    setEditKatNewName(name);
    setIsEditKatModalOpen(true);
  };

  const handleSaveEditKat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNew = editKatNewName.trim();
    if (!trimmedNew) {
      showToast('Nama kategori tidak boleh kosong', 'error');
      return;
    }

    if (trimmedNew.toLowerCase() === editKatOldName.toLowerCase()) {
      setIsEditKatModalOpen(false);
      return;
    }

    const targetList = kategoriKas[editKatType];
    if (targetList.some((c) => c.toLowerCase() === trimmedNew.toLowerCase())) {
      showToast(`Kategori "${trimmedNew}" sudah ada`, 'error');
      return;
    }

    const updatedList = targetList.map((c) => (c === editKatOldName ? trimmedNew : c));
    const updatedConfig = {
      ...kategoriKas,
      [editKatType]: updatedList,
    };
    setKategoriKas(updatedConfig);
    saveKategoriKas(updatedConfig);

    // Sinkronkan nama kategori di riwayat transaksi kas (lewat service, bukan storage langsung)
    try {
      await kasService.renameKasKategori(editKatType, editKatOldName, trimmedNew);
    } catch (err) {
      showToast('Gagal menyinkronkan nama kategori pada transaksi kas', 'error');
    }

    setIsEditKatModalOpen(false);
    showToast(`Kategori berhasil diubah menjadi "${trimmedNew}"`);
  };

  const handleOpenDeleteKat = (name: string, type: 'pemasukan' | 'pengeluaran') => {
    setDeleteKatType(type);
    setDeleteKatTargetName(name);
    setIsDeleteKatModalOpen(true);
  };

  const handleConfirmDeleteKat = () => {
    if (!deleteKatTargetName) return;

    if (kategoriKas[deleteKatType].length <= 1) {
      showToast('Minimal harus ada satu kategori', 'error');
      return;
    }

    const previousConfig = kategoriKas;
    const updatedConfig = {
      ...kategoriKas,
      [deleteKatType]: kategoriKas[deleteKatType].filter((c) => c !== deleteKatTargetName),
    };
    setKategoriKas(updatedConfig);
    saveKategoriKas(updatedConfig);

    setIsDeleteKatModalOpen(false);
    showUndoToast(`Kategori "${deleteKatTargetName}" dihapus`, 'Urungkan', () => {
      setKategoriKas(previousConfig);
      saveKategoriKas(previousConfig);
      showToast(`Kategori "${deleteKatTargetName}" dikembalikan`, 'success');
    });
  };

  // Desain Kwitansi Handlers — dikelola di komponen KwitansiTab

  // Backup & Restore Handlers
  const handleDownloadBackup = async () => {
    try {
      const backup = isApiMode() ? await unduhBackupApi() : buildBackup();
      const dataStr =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      const dateStr = todayLocal();
      downloadAnchor.setAttribute('download', `backup-alhidayah-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Backup data berhasil diunduh!');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal membuat file backup',
        'error'
      );
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetFileInput();

    setConfirmState({
      title: 'Pulihkan Data dari Backup',
      message:
        'Data saat ini akan DITIMPA seluruhnya dengan isi file backup.\n\nPastikan Anda sudah melakukan backup data terbaru sebelum melanjutkan.',
      confirmLabel: 'Ya, Timpa Data',
      variant: 'warning',
      onConfirm: () => {
        setConfirmState(null);
        prosesRestoreFile(file);
      },
    });
  };

  /** Baca file backup lama, tanyakan dulu lewat dialog, lalu jalankan restore. */
  const prosesRestoreFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      let json: unknown;
      try {
        json = JSON.parse(String(event.target?.result ?? ''));
      } catch {
        showToast('File backup bukan JSON yang valid', 'error');
        return;
      }

      try {
        if (isApiMode()) {
          void pulihkanBackupApi(json)
            .then((jumlah) => {
              showToast(`Restore berhasil (${jumlah} tabel). Memuat ulang halaman...`);
              setTimeout(() => window.location.reload(), 1200);
            })
            .catch((err) =>
              showToast(
                err instanceof Error ? err.message : 'Gagal memulihkan data backup',
                'error'
              )
            );
          return;
        }

        const result = restoreBackup(json);
        showToast(
          `Restore berhasil (${result.restored} kelompok data). Memuat ulang halaman...`
        );
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Gagal memulihkan data backup',
          'error'
        );
      }
    };
    reader.onerror = () => showToast('Gagal membaca file backup', 'error');
    reader.readAsText(file);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="px-2.5 py-0.5 rounded-md font-semibold text-xs bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
            <Shield className="w-3 h-3 text-purple-600" />
            Super Admin
          </span>
        );
      case 'admin':
        return (
          <span className="px-2.5 py-0.5 rounded-md font-semibold text-xs bg-blue-50 text-blue-700 border border-blue-200">
            Administrator
          </span>
        );
      case 'pemilik':
        return (
          <span className="px-2.5 py-0.5 rounded-md font-semibold text-xs bg-amber-50 text-amber-700 border border-amber-200">
            Pengasuh / Pemilik
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Dialog konfirmasi generik (menggantikan window.confirm) */}
      <ConfirmDialog
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        onConfirm={() => confirmState?.onConfirm()}
        onClose={() => setConfirmState(null)}
      />

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          Pengaturan Sistem
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Kelola profil pondok, nominal tarif default, dan konfigurasi sistem
        </p>
      </div>

      {/* Tab Navigation with Scroll Buttons ('<' and '>') */}
      <div className="relative flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => scrollTabs('left')}
          className="p-1.5 rounded-full bg-white/95 border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-100 transition-colors shrink-0 z-10 cursor-pointer"
          title="Geser Kiri"
          aria-label="Geser Kiri"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={tabContainerRef}
          className="flex overflow-x-auto whitespace-nowrap scrollbar-hide no-scrollbar flex-1 items-center gap-4 sm:gap-6 text-sm font-medium px-2 py-1"
        >
          {[
            { key: 'profil', label: 'Profil Pondok', icon: Building2 },
            { key: 'tarif', label: 'Tarif Default', icon: DollarSign },
            { key: 'users', label: 'Manajemen Pengguna', icon: Users },
            { key: 'iuran', label: 'Iuran Tambahan', icon: Layers },
            { key: 'master_iuran', label: 'Master Iuran', icon: FolderOpen },
            { key: 'kategori_kas', label: 'Kategori Kas', icon: DollarSign },
            { key: 'kopdesain', label: 'Desain Kop Surat', icon: Palette },
            { key: 'kwitansi', label: 'Desain Kwitansi', icon: FileText },
            { key: 'backup', label: 'Backup & Restore', icon: Database },
                      ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as ActiveTab)}
                className={`py-3 inline-flex items-center gap-2 font-semibold transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-[#059669] text-[#059669]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
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
          className="p-1.5 rounded-full bg-white/95 border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-100 transition-colors shrink-0 z-10 cursor-pointer"
          title="Geser Kanan"
          aria-label="Geser Kanan"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: PROFIL PONDOK */}
      {activeTab === 'profil' && (
        <div className="space-y-6">
          {/* Struktur Kartu Profil Utama */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header Kartu */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-slate-100 bg-white">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  Profil Pondok Pesantren
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identitas resmi lembaga dan susunan pengurus pondok pesantren
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenProfilModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer self-start sm:self-auto shrink-0"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Profil</span>
              </button>
            </div>

            {/* Konten Profil: Dua Kolom (Kiri: Logo 24x24 border tipis, Kanan: Detail Data Grid) */}
            <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start gap-6 lg:gap-8 bg-white">
              {/* Kolom Kiri: Logo 24x24 dengan border tipis */}
              <div className="flex flex-col items-center gap-2 shrink-0 self-center md:self-start">
                <div className="w-24 h-24 rounded-2xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden p-2 shadow-2xs">
                  {profil.logo ? (
                    <img
                      src={profil.logo}
                      alt={profil.nama_pondok}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Building2 className="w-10 h-10 text-emerald-600" />
                      <span className="text-[10px] text-slate-400 mt-1 font-medium">Logo</span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-medium text-slate-400 text-center">
                  Logo Pondok
                </span>
              </div>

              {/* Kolom Kanan: Detail Data dalam Grid yang Rapi */}
              <div className="flex-1 min-w-0 space-y-5 w-full">
                {/* Nama Pondok */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block">
                    Nama Lembaga
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                    {profil.nama_pondok || 'Nama Pondok Belum Diatur'}
                  </h3>
                </div>

                <div className="border-t border-slate-100" />

                {/* Grid Informasi Pengurus & Kontak (Clean White, No thick gray backgrounds) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs">
                  {/* Pengasuh */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Pengasuh</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {profil.pengasuh || '-'}
                    </p>
                  </div>

                  {/* Ketua */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ketua Pondok</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {profil.ketua || '-'}
                    </p>
                  </div>

                  {/* Sekretaris */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sekretaris</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {profil.sekretaris || '-'}
                    </p>
                  </div>

                  {/* Bendahara */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Bendahara</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {profil.bendahara || '-'}
                    </p>
                  </div>

                  {/* Kontak */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kontak / Telepon</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm font-mono">
                      {profil.kontak || '-'}
                    </p>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <Mail className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Email</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {profil.email || '-'}
                    </p>
                  </div>

                  {/* Alamat Lengkap */}
                  <div className="sm:col-span-2 lg:col-span-3 space-y-1 pt-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Alamat Lengkap</span>
                    </div>
                    <p className="font-medium text-slate-800 text-sm leading-relaxed">
                      {profil.alamat || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Edit Ringkas (max-w-lg) */}
          {isProfilModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={() => setIsProfilModalOpen(false)}
              />

              {/* Modal Card */}
              <div className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-10 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* 1. Header Modal (Sticky / Fixed Top) */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Edit Profil Pondok
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Perbarui identitas dan susunan pengurus pondok pesantren
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsProfilModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Wrapper */}
                <form
                  onSubmit={handleSaveProfilModal}
                  className="flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                  {/* 2. Body Modal (Scrollable Area with padding) */}
                  <div className="overflow-y-auto flex-1 p-6 space-y-4 text-xs">
                    {/* Upload Logo Horizontal: Ikon di kiri, Teks & tombol di kanan (Hemat Tempat) */}
                    <div className="flex items-center gap-3.5 p-3 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 bg-white transition-colors">
                      <div className="w-14 h-14 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        {profilForm.logo ? (
                          <img
                            src={profilForm.logo}
                            alt="Logo preview"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Building2 className="w-6 h-6 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-slate-800">
                          Logo Pondok Pesantren
                        </span>
                        <span className="block text-[11px] text-slate-400 truncate">
                          Format PNG, JPG, atau WebP (Maks. 2MB)
                        </span>
                        <div className="flex items-center gap-2.5 mt-1.5">
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{profilForm.logo ? 'Ganti Logo' : 'Unggah Logo'}</span>
                          </button>
                          {profilForm.logo && (
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </div>

                    {/* Nama Pondok Pesantren */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Pondok Pesantren <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={profilForm.nama_pondok}
                        onChange={(e) =>
                          setProfilForm({ ...profilForm, nama_pondok: e.target.value })
                        }
                        placeholder="Contoh: Pondok Pesantren Al Hidayah"
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        required
                      />
                    </div>

                    {/* Alamat Lengkap */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alamat Lengkap <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={profilForm.alamat}
                        onChange={(e) =>
                          setProfilForm({ ...profilForm, alamat: e.target.value })
                        }
                        placeholder="Alamat lengkap pondok pesantren..."
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        required
                      />
                    </div>

                    {/* Kontak & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          No. Kontak / Telepon
                        </label>
                        <input
                          type="text"
                          value={profilForm.kontak || ''}
                          onChange={(e) =>
                            setProfilForm({ ...profilForm, kontak: e.target.value })
                          }
                          placeholder="08xxxxxxxxxx"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Email Pondok
                        </label>
                        <input
                          type="email"
                          value={profilForm.email || ''}
                          onChange={(e) =>
                            setProfilForm({ ...profilForm, email: e.target.value })
                          }
                          placeholder="pondok@example.com"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Form Pengurus: Grid 2x2 (Pengasuh, Ketua, Sekretaris, Bendahara) */}
                    <div>
                      <span className="block text-xs font-semibold text-slate-700 mb-2">
                        Susunan Pengurus Pondok
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Pengasuh Pondok
                          </label>
                          <input
                            type="text"
                            value={profilForm.pengasuh}
                            onChange={(e) =>
                              setProfilForm({ ...profilForm, pengasuh: e.target.value })
                            }
                            placeholder="Nama Pengasuh"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Ketua Pondok
                          </label>
                          <input
                            type="text"
                            value={profilForm.ketua}
                            onChange={(e) =>
                              setProfilForm({ ...profilForm, ketua: e.target.value })
                            }
                            placeholder="Nama Ketua"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Sekretaris
                          </label>
                          <input
                            type="text"
                            value={profilForm.sekretaris || ''}
                            onChange={(e) =>
                              setProfilForm({ ...profilForm, sekretaris: e.target.value })
                            }
                            placeholder="Nama Sekretaris"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Bendahara
                          </label>
                          <input
                            type="text"
                            value={profilForm.bendahara}
                            onChange={(e) =>
                              setProfilForm({ ...profilForm, bendahara: e.target.value })
                            }
                            placeholder="Nama Bendahara"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Padding Spacer */}
                    <div className="h-2" />
                  </div>

                  {/* 3. Footer Modal (Sticky / Fixed Bottom) */}
                  <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsProfilModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer font-medium"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Profil</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TARIF DEFAULT */}
      {activeTab === 'tarif' && (
        <div className="space-y-6">
          {/* Bagian Atas: Tarif Aktif Saat Ini */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900">
                    Tarif Aktif Saat Ini
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Berlaku Mulai: {formatPeriodeBulan(tarif.periode_mulai || `${new Date().getFullYear()}-01`)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Nominal syahriyah (Mukim/Nduduk) dan tarif event kilatan yang sedang berlaku
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenTarifModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Tarif Aktif</span>
              </button>
            </div>

            {/* Grid Cards 4 Kolom: Mukim, Nuduk, Kilatan, Event */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
              {/* Card 1: Syahriyah Mukim */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-xs transition-all flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 block">
                    Syahriyah Mukim
                  </span>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight">
                    {formatRupiah(tarif.syahriyah_mukim)}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    per bulan / santri mukim
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                  <Home className="w-5 h-5" />
                </div>
              </div>

              {/* Card 2: Syahriyah Nduduk */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-xs transition-all flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 block">
                    Syahriyah Nuduk
                  </span>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight">
                    {formatRupiah(tarif.syahriyah_nduduk)}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    per bulan / santri nduduk
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3: Event Kilatan */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-xs transition-all flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 block">
                    Event Kilatan
                  </span>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight">
                    {formatRupiah(tarif.event_kilatan)}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    per paket / event
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Bagian Bawah: Arsip Tarif (Tabel Riwayat) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-600 border-b border-slate-200 font-semibold tracking-wide">
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3">Mukim</th>
                    <th className="px-4 py-3">Nuduk</th>
                                        <th className="px-4 py-3">Event Kilatan</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buildTarifTableRows().length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        <Archive className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        Belum ada data tarif
                      </td>
                    </tr>
                  ) : (
                    buildTarifTableRows().map((item) => {
                      const isAktif = item.status === 'Aktif';
                      const isJadwal = item.status === 'Dijadwalkan';
                      return (
                      <tr
                        key={item.id}
                        className={
                          isAktif
                            ? 'bg-emerald-50/70 hover:bg-emerald-50 transition-colors'
                            : isJadwal
                              ? 'bg-sky-50/50 hover:bg-sky-50/80 transition-colors'
                              : 'hover:bg-slate-50/50 transition-colors'
                        }
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className={`w-3.5 h-3.5 ${isAktif ? 'text-emerald-500' : isJadwal ? 'text-sky-500' : 'text-slate-400'}`} />
                            <span>
                              {formatPeriodeRange(
                                item.periode_mulai,
                                item.periode_selesai,
                                {
                                  ongoingLabel:
                                    item.status === 'Dijadwalkan' ? 'dst.' : 'Sekarang',
                                }
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {formatRupiah(item.syahriyah_mukim)}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {formatRupiah(item.syahriyah_nduduk)}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {formatRupiah(item.event_kilatan)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {isAktif ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Aktif
                            </span>
                          ) : isJadwal ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                              Dijadwalkan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <Archive className="w-3 h-3 text-slate-400" />
                              Diarsipkan
                            </span>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Edit Tarif Ringkas (max-w-xl) */}
          {isTarifModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={() => setIsTarifModalOpen(false)}
              />

              {/* Modal Card */}
              <div className="relative w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-10 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* 1. Header Modal (Sticky / Fixed Top) */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Edit Tarif Aktif
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Perbarui nominal tarif default dan tentukan periode baru
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTarifModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Wrapper */}
                <form
                  onSubmit={handleSaveTarifModal}
                  className="flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                  {/* 2. Body Modal (Scrollable Area with padding) */}
                  <div className="overflow-y-auto flex-1 p-6 space-y-4 text-xs">
                    {/* Grid 2x2: Mukim & Nuduk di atas, Kilatan & Event di bawah */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Syahriyah Mukim */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Syahriyah Mukim <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-xs font-semibold text-slate-400 select-none">
                            Rp
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={tarifForm.syahriyah_mukim || ''}
                            onChange={(e) =>
                              setTarifForm({
                                ...tarifForm,
                                syahriyah_mukim: Number(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                            className="w-full pl-10 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            required
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Nominal bulanan santri mukim
                        </span>
                      </div>

                      {/* Syahriyah Nduduk */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Syahriyah Nuduk <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-xs font-semibold text-slate-400 select-none">
                            Rp
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={tarifForm.syahriyah_nduduk || ''}
                            onChange={(e) =>
                              setTarifForm({
                                ...tarifForm,
                                syahriyah_nduduk: Number(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                            className="w-full pl-10 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            required
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Nominal bulanan santri nduduk
                        </span>
                      </div>

                      {/* Event Kilatan */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Event Kilatan <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-xs font-semibold text-slate-400 select-none">
                            Rp
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={tarifForm.event_kilatan || ''}
                            onChange={(e) =>
                              setTarifForm({
                                ...tarifForm,
                                event_kilatan: Number(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                            className="w-full pl-10 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            required
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Tarif paket event kilatan
                        </span>
                      </div>
                    </div>

                    {/* Periode Mulai Berlaku (type="month") */}
                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Periode Mulai Berlaku <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="month"
                        value={tarifForm.periode_mulai || ''}
                        onChange={(e) =>
                          setTarifForm({
                            ...tarifForm,
                            periode_mulai: e.target.value,
                          })
                        }
                        className="w-full sm:w-64 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        required
                      />
                    </div>

                    {/* Teks Peringatan Kecil */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        Jika periode mulai di masa depan, tarif disimpan sebagai Dijadwalkan (tarif aktif tetap berlaku). Jika periode mulai sekarang/lalu, tarif lama diarsipkan (selesai H-1 periode baru). Periode hanya boleh tanpa pembayaran santri.
                      </p>
                    </div>

                    {/* Bottom Padding Spacer */}
                    <div className="h-2" />
                  </div>

                  {/* 3. Footer Modal (Sticky / Fixed Bottom) */}
                  <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsTarifModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer font-medium"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Tarif</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Dialog Error: Perubahan Tarif Diblokir */}
          {isTarifErrorOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity"
                onClick={() => setIsTarifErrorOpen(false)}
              />
              <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
                {/* Accent bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-rose-400" />

                <div className="px-6 pt-6 pb-2 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 border border-rose-100">
                    <AlertTriangle className="h-7 w-7 text-rose-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    Tidak Dapat Menyimpan Perubahan
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    Perubahan tarif tidak dapat diterapkan karena masih terdapat
                    data pembayaran pada periode yang dipilih.
                  </p>
                </div>

                <div className="px-6 py-4">
                  <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-3.5 text-left">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-rose-100 shadow-sm">
                      <Calendar className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-rose-900">
                        Periode yang dipilih sudah memiliki transaksi pembayaran aktif.
                      </p>
                      {tarifErrorPeriod && (
                        <p className="mt-1 text-xs text-rose-700/90">
                          Periode mulai:{' '}
                          <span className="font-mono font-semibold">{tarifErrorPeriod}</span>
                          {tarifErrorMonths.length > 0 && (
                            <>
                              {' '}
                              · Bulan terblokir:{' '}
                              <span className="font-mono font-semibold">
                                {tarifErrorMonths.slice(0, 4).join(', ')}
                                {tarifErrorMonths.length > 4
                                  ? ` (+${tarifErrorMonths.length - 4})`
                                  : ''}
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 px-6 pb-6 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTarifErrorOpen(false);
                      // Tetap di modal edit tarif agar user bisa ganti periode
                      setIsTarifModalOpen(true);
                    }}
                    className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                  >
                    Pilih Periode Lain
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTarifErrorOpen(false)}
                    className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-200 transition-colors cursor-pointer"
                  >
                    Mengerti
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANAJEMEN PENGGUNA */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-[#0F172A]">Daftar Pengguna Sistem</h2>
            <button
              onClick={handleAddUser}
              className="px-3.5 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pengguna</span>
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Nama Lengkap</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = currentUser?.username === u.username;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#0F172A]">
                          <div className="flex items-center gap-2">
                            <span>{u.nama}</span>
                            {isSelf && (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                Saya
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {u.username}
                        </td>
                        <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                        <td className="px-4 py-3">
                          {u.status === 'Aktif' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-red-50 text-red-700 border border-red-200">
                              <UserX className="w-3 h-3 text-red-500" />
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleEditUser(u)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Edit User"
                            >
                              <Edit className="w-3.5 h-3.5 text-slate-500" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={isSelf}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors shadow-2xs flex items-center gap-1 ${
                                isSelf
                                  ? 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed opacity-60'
                                  : 'border-red-200 text-red-600 bg-white hover:bg-red-50 cursor-pointer'
                              }`}
                              title={
                                isSelf
                                  ? 'Tidak dapat menghapus akun sendiri'
                                  : 'Hapus User'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: IURAN TAMBAHAN */}
      {activeTab === 'iuran' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Pengaturan Iuran Tambahan</h2>
              <p className="text-xs text-slate-500">
                Kelola daftar iuran tambahan seperti seragam, kitab, dll.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingIuran(null);
                setIuranForm({ nama: '', tipe: 'Keduanya', nominal: 0 });
                setIsIuranModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Iuran</span>
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Nama Iuran</th>
                    <th className="px-4 py-3">Tipe Pembayaran</th>
                    <th className="px-4 py-3 text-right">Nominal Default</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {iuranList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-400">
                        Belum ada data iuran tambahan.
                      </td>
                    </tr>
                  ) : (
                    iuranList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#0F172A]">
                          {item.nama}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                            {item.tipe}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                          Rp {item.nominal.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingIuran(item);
                                setIuranForm({
                                  nama: item.nama,
                                  tipe: item.tipe,
                                  nominal: item.nominal,
                                });
                                setIsIuranModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5 text-slate-500" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteIuran(item.id)}
                              className="px-2.5 py-1 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-medium transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: KATEGORI KAS */}
      
      {/* TAB: MASTER IURAN */}
      {activeTab === 'master_iuran' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Master Iuran</h2>
              <p className="text-xs text-slate-500 max-w-xl">
                Kelola program iuran (contoh: Haul Akbar). Nama, nominal default, dan jenis periode
                ditentukan Superadmin. Pembayaran dicatat terpisah saat ada yang bayar.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateMasterIuran}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Master Iuran
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                    <th className="px-4 py-3 font-semibold">Nama Iuran</th>
                    <th className="px-4 py-3 font-semibold">Nominal Default</th>
                    <th className="px-4 py-3 font-semibold">Jenis Periode</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
                    <th className="px-4 py-3 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {masterIuranList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        <FolderOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        Belum ada master iuran. Klik &quot;Tambah Master Iuran&quot; untuk membuat.
                      </td>
                    </tr>
                  ) : (
                    masterIuranList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.nama}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {formatRupiah(item.nominal_default)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-semibold">
                            {labelPeriodeIuran(item.jenis_periode)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.status === 'Aktif' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                          {item.keterangan || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditMasterIuran(item)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMasterIuran(item.id)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

{activeTab === 'kategori_kas' && (
        <div className="space-y-6">
          {/* Judul Konten */}
          <div>
            <h2 className="text-xl font-bold text-slate-900">Kelola Kategori Kas</h2>
            <p className="text-sm text-slate-500 mt-1">
              Pengaturan kategori untuk transaksi Pemasukan dan Pengeluaran.
            </p>
          </div>

          {/* Grid Kategori */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* KOLOM PEMASUKAN */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
              <h3 className="text-base font-bold text-emerald-700 border-b-2 border-emerald-100 pb-3 mb-4">
                Kategori Pemasukan
              </h3>

              {/* Form Tambah */}
              <form onSubmit={handleAddKatPemasukan} className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="Nama kategori baru..."
                  value={newKatPemasukan}
                  onChange={(e) => setNewKatPemasukan(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors outline-none"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </form>

              {/* Daftar Kategori */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {kategoriKas.pemasukan.length === 0 ? (
                  <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Belum ada kategori</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Tambahkan kategori pemasukan baru menggunakan formulir di atas
                    </p>
                  </div>
                ) : (
                  kategoriKas.pemasukan.map((cat) => {
                    const count = katCounts[`pemasukan|${cat}`] || 0;
                    return (
                      <div
                        key={cat}
                        className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{cat}</p>
                          <p className="text-xs text-slate-400">
                            {count > 0 ? `Digunakan di ${count} transaksi` : 'Belum ada transaksi'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenEditKat(cat, 'pemasukan')}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteKat(cat, 'pemasukan')}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* KOLOM PENGELUARAN */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
              <h3 className="text-base font-bold text-red-700 border-b-2 border-red-100 pb-3 mb-4">
                Kategori Pengeluaran
              </h3>

              {/* Form Tambah */}
              <form onSubmit={handleAddKatPengeluaran} className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="Nama kategori baru..."
                  value={newKatPengeluaran}
                  onChange={(e) => setNewKatPengeluaran(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm transition-colors outline-none"
                />
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </form>

              {/* Daftar Kategori */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {kategoriKas.pengeluaran.length === 0 ? (
                  <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2">
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Belum ada kategori</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Tambahkan kategori pengeluaran baru menggunakan formulir di atas
                    </p>
                  </div>
                ) : (
                  kategoriKas.pengeluaran.map((cat) => {
                    const count = katCounts[`pengeluaran|${cat}`] || 0;
                    return (
                      <div
                        key={cat}
                        className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{cat}</p>
                          <p className="text-xs text-slate-400">
                            {count > 0 ? `Digunakan di ${count} transaksi` : 'Belum ada transaksi'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenEditKat(cat, 'pengeluaran')}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteKat(cat, 'pengeluaran')}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* MODAL EDIT KATEGORI                        */}
          {/* ========================================== */}
          {isEditKatModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={() => setIsEditKatModalOpen(false)}
              />
              <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">Edit Kategori</h3>
                  <button
                    type="button"
                    onClick={() => setIsEditKatModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveEditKat}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nama Kategori
                    </label>
                    <input
                      type="text"
                      value={editKatNewName}
                      onChange={(e) => setEditKatNewName(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition-all"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditKatModalOpen(false)}
                      className="py-2 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* MODAL KONFIRMASI HAPUS                     */}
          {/* ========================================== */}
          {isDeleteKatModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={() => setIsDeleteKatModalOpen(false)}
              />
              <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 text-center z-10 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Kategori?</h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Anda yakin ingin menghapus kategori{' '}
                  <strong className="text-slate-800 font-semibold">{deleteKatTargetName}</strong>? Data transaksi yang
                  menggunakan kategori ini mungkin akan terdampak.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDeleteKatModalOpen(false)}
                    className="py-2 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 w-full transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteKat}
                    className="py-2 px-4 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 w-full transition-colors cursor-pointer shadow-xs"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: DESAIN KOP SURAT & DESAIN KWITANSI */}
      {activeTab === 'kopdesain' && <KopSuratTab />}

      {activeTab === 'kwitansi' && <KwitansiTab />}


      {/* TAB 7: BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs max-w-2xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Backup & Restore Data Sistem</h2>
            <p className="text-xs text-slate-500 mt-1">
              Unduh salinan data seluruh aplikasi atau pulihkan data dari file JSON cadangan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Backup Button */}
            <div className="border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center space-y-3 bg-slate-50/60">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Backup Data</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Simpan seluruh data ke file JSON.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Backup (JSON)</span>
              </button>
            </div>

            {/* Restore Button */}
            <div className="border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center space-y-3 bg-slate-50/60">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Restore Data</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Muat data dari file JSON cadangan.
                </p>
              </div>
              <label className="w-full px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Restore Data (JSON)</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleRestoreUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <strong className="block font-semibold">Peringatan Penting:</strong>
              <p>
                Gunakan fitur ini secara berkala untuk menghindari kehilangan data. Melakukan restore akan menimpa seluruh data yang ada saat ini.
              </p>
              <p className="mt-1">
                File backup berisi password akun dalam teks biasa. Simpan file backup sebagai file rahasia dan jangan dibagikan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit User */}
      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingUser={editingUser}
        onSuccess={loadAllData}
      />

      
      {/* Modal Master Iuran */}
      {isMasterIuranModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={() => setIsMasterIuranModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingMasterIuran ? 'Edit Master Iuran' : 'Tambah Master Iuran'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMasterIuranModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveMasterIuran} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Iuran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={masterIuranForm.nama}
                  onChange={(e) => setMasterIuranForm({ ...masterIuranForm, nama: e.target.value })}
                  placeholder="Contoh: Haul Akbar"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nominal Default (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={masterIuranForm.nominal_default}
                  onChange={(e) =>
                    setMasterIuranForm({
                      ...masterIuranForm,
                      nominal_default: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 text-slate-800 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Acuan saat mencatat pembayaran; bisa diubah di form bayar.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jenis Periode <span className="text-red-500">*</span>
                </label>
                <select
                  value={masterIuranForm.jenis_periode}
                  onChange={(e) =>
                    setMasterIuranForm({
                      ...masterIuranForm,
                      jenis_periode: e.target.value as JenisPeriodeIuran,
                    })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 text-slate-800 bg-white cursor-pointer"
                >
                  <option value="sekali">Sekali</option>
                  <option value="bulanan">Bulanan</option>
                  <option value="tahunan">Tahunan</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={masterIuranForm.status}
                  onChange={(e) =>
                    setMasterIuranForm({
                      ...masterIuranForm,
                      status: e.target.value as StatusMasterIuran,
                    })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 text-slate-800 bg-white cursor-pointer"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan</label>
                <textarea
                  value={masterIuranForm.keterangan}
                  onChange={(e) =>
                    setMasterIuranForm({ ...masterIuranForm, keterangan: e.target.value })
                  }
                  rows={2}
                  placeholder="Opsional"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 text-slate-800 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMasterIuranModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

{/* Modal Add / Edit Iuran Tambahan */}
      {isIuranModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setIsIuranModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingIuran ? 'Edit Iuran Tambahan' : 'Tambah Iuran Tambahan'}
            </h3>

            <form onSubmit={handleSaveIuran} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Iuran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={iuranForm.nama}
                  onChange={(e) =>
                    setIuranForm({ ...iuranForm, nama: e.target.value })
                  }
                  placeholder="Contoh: Seragam, Buku Kitab, Pembangunan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tipe Pembayaran <span className="text-red-500">*</span>
                </label>
                <select
                  value={iuranForm.tipe}
                  onChange={(e) =>
                    setIuranForm({
                      ...iuranForm,
                      tipe: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 text-slate-800 bg-white"
                >
                  <option value="Syahriyah">Syahriyah</option>
                  <option value="Kilatan">Kilatan</option>
                  <option value="Keduanya">Keduanya</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nominal Default (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={iuranForm.nominal}
                  onChange={(e) =>
                    setIuranForm({
                      ...iuranForm,
                      nominal: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 text-slate-800 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIuranModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PengaturanPage;
