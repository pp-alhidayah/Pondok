import { storage } from '../../lib/storage';
import { todayLocal } from '../../lib/core';
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  Printer,
} from 'lucide-react';
import { Santri } from '../../types/santri';
import {
  SyahriyahBulan,
  SyahriyahItemInput,
  IuranTambahanInput,
  SyahriyahTransaksiRecord,
} from '../../types/syahriyah';
import {
  syahriyahService,
  getTarifSyahriyah,
  isBeforeEntry,
  isSyahriyahSetelahKeluar,
} from '../../lib/syahriyahService';
import { santriService } from '../../lib/santriService';
import { iuranPembayaranService, type IuranTambahanItem } from '../../lib/iuranPembayaranService';
import { showToast } from '../../components/ui/Toast';
import { formatRupiah, formatThousand, parseThousand } from '../../lib/formatter';
import { hitungTagihan, labelKeringanan, type HasilTagihan } from '../../lib/tagihanKeringanan';
import { waiverService, type SyahriyahWaiver } from '../../lib/waiverService';
import { generateKwitansiPdf, printKwitansiHtml } from '../../lib/pdfHelper';
import { StrukPembayaranCard, StrukData } from '../../components/ui/StrukPembayaranCard';

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

interface SyahriyahPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  santri: Santri | null; // null if opened via top "+ Catat Pembayaran" button
  tahunAktif: number;
  bulanAktif?: number | null; // 1-12
  onSuccess: () => void;
}

export const SyahriyahPaymentModal: React.FC<SyahriyahPaymentModalProps> = ({
  isOpen,
  onClose,
  santri: initialSantri,
  tahunAktif,
  bulanAktif,
  onSuccess,
}) => {
  // Santri selection state (for null initialSantri)
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [santriSearch, setSantriSearch] = useState('');
  const [selectedSantri, setSelectedSantri] = useState<Santri | null>(null);

  // Active year navigation in modal
  const [selectedYear, setSelectedYear] = useState<number>(tahunAktif);

  // Month status records for (selectedSantri, selectedYear)
  const [currentYearRecords, setCurrentYearRecords] = useState<SyahriyahBulan[]>([]);
  const [waivers, setWaivers] = useState<SyahriyahWaiver[]>([]);
  const [hasilBulanTerpilih, setHasilBulanTerpilih] = useState<HasilTagihan | null>(null);

  // Selected items keyed by `${tahun}-${bulan}`
  const [itemInputs, setItemInputs] = useState<Record<string, SyahriyahItemInput>>({});

  // Additional fees state
  const [iuranTambahan, setIuranTambahan] = useState<IuranTambahanInput[]>([]);
  const [iuranTambahanOptions, setIuranTambahanOptions] = useState<IuranTambahanItem[]>([]);

  // Payment detail states
  const [tanggalBayar, setTanggalBayar] = useState(
    todayLocal()
  );
  const [metode, setMetode] = useState<'Tunai' | 'Transfer' | 'Lainnya'>('Tunai');
  const [keterangan, setKeterangan] = useState('');
  const [isDeclared, setIsDeclared] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-submit success view state
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedRecord, setSavedRecord] = useState<SyahriyahTransaksiRecord | null>(null);

  // Load all santri for picker
  useEffect(() => {
    if (isOpen) {
      santriService
        .getSantriList()
        .then((data) => setSantriList(data.filter((s) => s.kategori !== 'Kilatan')))
        .catch(() => showToast('Gagal memuat daftar santri', 'error'));
    }
  }, [isOpen]);

  // Muat opsi iuran tambahan dari service (ganti akses storage langsung)
  useEffect(() => {
    if (isOpen) {
      iuranPembayaranService
        .getIuranTambahan('Syahriyah')
        .then((opts) => setIuranTambahanOptions(opts))
        .catch(() => showToast('Gagal memuat opsi iuran tambahan', 'error'));
    }
  }, [isOpen]);

  // Set initial santri, reset year & selection state
  useEffect(() => {
    if (isOpen) {
      const activeSantri =
        initialSantri && initialSantri.kategori !== 'Kilatan' ? initialSantri : null;
      setSelectedSantri(activeSantri);
      setSantriSearch('');
      setSelectedYear(tahunAktif);
      setIuranTambahan([]);
      setTanggalBayar(todayLocal());
      setMetode('Tunai');
      setKeterangan('');
      setIsDeclared(false);
      setItemInputs({});
      setIsSuccess(false);
      setSavedRecord(null);
    }
  }, [isOpen, initialSantri, tahunAktif]);

  // Fetch month records for selectedSantri & selectedYear
  useEffect(() => {
    if (isOpen && selectedSantri) {
      waiverService
        .getAll(selectedSantri.id, selectedYear)
        .then(setWaivers)
        .catch(() => setWaivers([]));
    }
  }, [isOpen, selectedSantri?.id, selectedYear]);

  // Fetch month records for selectedSantri & selectedYear
  useEffect(() => {
    if (isOpen && selectedSantri) {
      syahriyahService.getSyahriyahMatrix(selectedYear).then(async (matrix) => {
        const row = matrix.find((m) => m.santri.id === selectedSantri.id);
        if (row) {
          setCurrentYearRecords(row.records);

          // Auto-select initial bulanAktif if this is the initial setup turn and in matching initial year
          if (
            bulanAktif &&
            selectedYear === tahunAktif &&
            Object.keys(itemInputs).length === 0 &&
            !isSuccess
          ) {
            const targetRec = row.records.find((r) => r.bulan === bulanAktif);
            if (targetRec && targetRec.status !== 'Lunas') {
              const kategori = selectedSantri.kategori || 'Mukim';
              const tarifDasar = await getTarifSyahriyah(kategori, selectedYear, bulanAktif);
              const hasil = hitungTagihan({
                tarifDasar,
                waivers,
                santriId: selectedSantri.id,
                tahun: selectedYear,
                bulan: bulanAktif,
                sudahDibayar: targetRec.total_dibayar || 0,
              });
              const nominalBayar = hasil.sisa;
              const key = `${selectedYear}-${bulanAktif}`;
              setItemInputs({
                [key]: {
                  tahun: selectedYear,
                  bulan: bulanAktif,
                  nominal: nominalBayar,
                  jenis: 'Penuh',
                },
              });
            }
          }
        }
      }).catch(() => {
        showToast('Gagal memuat data syahriyah', 'error');
      });
    }
  }, [isOpen, selectedSantri, selectedYear, bulanAktif, tahunAktif, isSuccess, waivers]);

  /** Sisa tagihan = tarif periode − keringanan − yang sudah dibayar. */
  const getSisaTagihan = async (
    rec: {
      nominal_tagihan: number;
      total_dibayar: number;
      tahun?: number;
      keringanan?: boolean;
    },
    bulan: number
  ) => {
    const kategori = selectedSantri?.kategori || 'Mukim';
    const tahun = rec.tahun ?? selectedYear;
    const tarifDasar = await getTarifSyahriyah(kategori, tahun, bulan);
    return hitungTagihan({
      tarifDasar,
      waivers,
      santriId: selectedSantri?.id,
      tahun,
      bulan,
      sudahDibayar: rec.total_dibayar || 0,
    });
  };

  // Toggle month selection in selectedYear
  const handleToggleMonth = async (bulan: number) => {
    if (selectedSantri && isBeforeEntry(selectedSantri.tanggal_masuk, selectedYear, bulan)) {
      showToast('Pembayaran tidak dapat dilakukan karena sebelum tanggal santri masuk', 'error');
      return;
    }
    if (selectedSantri && isSyahriyahSetelahKeluar(selectedSantri, selectedYear, bulan)) {
      showToast('Pembayaran tidak dapat dilakukan karena santri tidak aktif pada bulan tersebut', 'error');
      return;
    }
    const rec = currentYearRecords.find((r) => r.bulan === bulan);
    if (!rec) return;
    if (rec.keringanan && rec.nominal_tagihan === 0) {
      showToast('Bulan ini bebas tagihan (keringanan penuh), tidak perlu dibayar', 'info');
      return;
    }
    if (rec.status === 'Lunas') return;

    const key = `${selectedYear}-${bulan}`;
    if (itemInputs[key]) {
      setItemInputs((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } else {
      const sisa = (await getSisaTagihan(rec, bulan)).sisa;
      const nominalBayar = sisa;
      setItemInputs((prev) => ({
        ...prev,
        [key]: {
          tahun: selectedYear,
          bulan,
          nominal: nominalBayar,
          jenis: 'Penuh',
        },
      }));
    }
  };

  // Item input changes
  const handleJenisChange = async (key: string, jenis: 'Penuh' | 'Sebagian') => {
    const item = itemInputs[key];
    if (!item) return;

    const rec = currentYearRecords.find((r) => r.bulan === item.bulan);
    const sisa = rec
      ? (await getSisaTagihan(rec, item.bulan)).sisa
      : await getTarifSyahriyah(selectedSantri?.kategori || 'Mukim', item.tahun, item.bulan);
    setItemInputs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        jenis,
        // Sebagian: tetap nominal penuh (sisa); user yang edit. Tidak auto bagi 2.
        nominal: Math.max(0, sisa),
      },
    }));
  };

  const handleNominalChange = async (key: string, valStr: string) => {
    let num = parseThousand(valStr);
    const item = itemInputs[key];
    if (item) {
      const rec = currentYearRecords.find((r) => r.bulan === item.bulan && r.tahun === item.tahun);
      // Jika rekaman ditemukan, gunakan sisa sebagai batas atas
      if (rec) {
        const sisa = (await getSisaTagihan(rec, item.bulan)).sisa;
        if (sisa > 0 && num > sisa) num = sisa;
      }
    }
    setItemInputs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        nominal: Math.max(0, num),
      },
    }));
  };

  const handleAddIuranLain = () => {
    const options = iuranTambahanOptions;
    const first = options[0] || { nama: '', nominal: 0 };
    setIuranTambahan((prev) => [
      ...prev,
      { id: 'i_' + Date.now(), nama: first.nama, nominal: first.nominal },
    ]);
  };

  const handleSelectIuranPreset = (id: string, selectedNama: string) => {
    const options = iuranTambahanOptions;
    const found = options.find((o) => o.nama === selectedNama);
    const nominal = found ? found.nominal : 0;
    setIuranTambahan((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, nama: selectedNama, nominal } : item
      )
    );
  };

  const handleRemoveIuranLain = (id: string) => {
    setIuranTambahan((prev) => prev.filter((i) => i.id !== id));
  };

  const handleIuranLainChange = (
    id: string,
    field: 'nama' | 'nominal',
    value: string
  ) => {
    setIuranTambahan((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (field === 'nominal') {
            return { ...item, nominal: parseThousand(value) };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // List of selected items across all years
  const selectedItemsList = useMemo(() => {
    return Object.values(itemInputs).sort((a, b) => {
      if (a.tahun !== b.tahun) return a.tahun - b.tahun;
      return a.bulan - b.bulan;
    });
  }, [itemInputs]);

  // Selected keys in other years than selectedYear
  const selectedKeysInOtherYearsCount = useMemo(() => {
    return Object.values(itemInputs).filter((i) => i.tahun !== selectedYear).length;
  }, [itemInputs, selectedYear]);

  // Total Calculation
  const totalItemNominal = useMemo(() => {
    return selectedItemsList.reduce((sum, item) => sum + (item.nominal || 0), 0);
  }, [selectedItemsList]);

  const totalIuranLainNominal = useMemo(() => {
    return iuranTambahan.reduce((sum, item) => sum + (item.nominal || 0), 0);
  }, [iuranTambahan]);

  const totalPembayaran = totalItemNominal + totalIuranLainNominal;

  // Filtered santri for picker
  const filteredSantriPicker = useMemo(() => {
    if (!santriSearch.trim()) return [];
    const q = santriSearch.trim().toLowerCase();
    // Hanya Mukim & Nduduk (Kilatan tidak bayar syahriyah bulanan)
    return santriList.filter(
      (s) =>
        s.kategori !== 'Kilatan' &&
        (s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q))
    );
  }, [santriList, santriSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSantri) {
      showToast('Pilih santri terlebih dahulu', 'error');
      return;
    }
    if (selectedItemsList.length === 0) {
      showToast('Pilih minimal satu bulan yang akan dibayar', 'error');
      return;
    }
    if (totalPembayaran <= 0) {
      showToast('Nominal pembayaran harus lebih dari Rp 0', 'error');
      return;
    }

    // Sinkronkan Penuh = sisa pasti; tolak Sebagian/Penuh yang melebihi sisa
    const itemsToSubmit = await Promise.all(selectedItemsList.map(async (it) => {
      const rec =
        currentYearRecords.find((r) => r.bulan === it.bulan && r.tahun === it.tahun) ||
        currentYearRecords.find((r) => r.bulan === it.bulan);
      const sisa = rec
        ? (await getSisaTagihan(rec, it.bulan)).sisa
        : await getTarifSyahriyah(selectedSantri.kategori, it.tahun, it.bulan);
      if (it.jenis === 'Penuh') {
        return { ...it, nominal: sisa };
      }
      return { ...it, nominal: Math.min(it.nominal, sisa) };
    }));

    for (const it of itemsToSubmit) {
      if (it.nominal <= 0) {
        showToast(`Nominal bulan ${it.bulan}/${it.tahun} harus lebih dari 0`, 'error');
        return;
      }
      const rec =
        currentYearRecords.find((r) => r.bulan === it.bulan && r.tahun === it.tahun) ||
        currentYearRecords.find((r) => r.bulan === it.bulan);
      if (rec) {
        const sisa = (await getSisaTagihan(rec, it.bulan)).sisa;
        if (it.nominal > sisa) {
          showToast(
            `Nominal bulan ${it.bulan}/${it.tahun} melebihi sisa tagihan (${formatRupiah(sisa)}).`,
            'error'
          );
          return;
        }
      }
    }

    if (!isDeclared) {
      showToast('Centang pernyataan kebenaran pembayaran terlebih dahulu', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const rec = await syahriyahService.simpanPembayaranSyahriyah(
        selectedSantri.id,
        itemsToSubmit,
        {
          tanggal_bayar: tanggalBayar,
          metode,
          keterangan: keterangan.trim() || undefined,
          iuran_tambahan: iuranTambahan.filter((i) => i.nama.trim() && i.nominal > 0),
        }
      );

      setSavedRecord(rec);
      setIsSuccess(true);
      showToast(
        `Pembayaran Syahriyah ${selectedSantri.nama} berhasil dicatat & masuk ke Buku Kas!`,
        'success'
      );
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Gagal mencatat pembayaran syahriyah', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!savedRecord || !selectedSantri) return;
    generateKwitansiPdf(savedRecord, selectedSantri);
  };

  const handlePrint = () => {
    if (!savedRecord || !selectedSantri) return;
    printKwitansiHtml(savedRecord, selectedSantri);
  };

  // Tarif acuan dan sisa — dihitung async dari service
  // Catatan: hook HARUS dipanggil sebelum `if (!isOpen) return null`.
  const [tarifBulan, setTarifBulan] = useState<number>(0);
  const [sisaBulanTerpilih, setSisaBulanTerpilih] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedSantri) {
      setTarifBulan(0);
      setSisaBulanTerpilih(null);
      return;
    }
    const list = Object.values(itemInputs);
    const compute = async () => {
      if (list.length === 1) {
        const it = list[0];
        const rec = currentYearRecords.find((r) => r.bulan === it.bulan);
        const tarifDasar = await getTarifSyahriyah(selectedSantri.kategori, it.tahun, it.bulan);
        const hasil = hitungTagihan({
          tarifDasar,
          waivers,
          santriId: selectedSantri.id,
          tahun: it.tahun,
          bulan: it.bulan,
          sudahDibayar: rec?.total_dibayar || 0,
        });
        setTarifBulan(hasil.tarifDasar);
        setSisaBulanTerpilih(hasil.sisa);
        setHasilBulanTerpilih(hasil);
      } else {
        setTarifBulan(await getTarifSyahriyah(selectedSantri.kategori));
        setSisaBulanTerpilih(null);
        setHasilBulanTerpilih(null);
      }
    };
    compute();
  }, [selectedSantri, itemInputs, currentYearRecords, waivers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden">
        {isSuccess && savedRecord && selectedSantri ? (
          /* VISUAL PAPER STRUK PEMBAYARAN VIEW */
          (() => {
            const strukItems = savedRecord.items.map((it) => ({
              deskripsi: `Syahriyah ${BULAN_FULL_NAMES[it.bulan - 1]} ${it.tahun} (${it.jenis || 'Penuh'})`,
              nominal: it.nominal,
            }));

            const iuranTambahanItems = savedRecord.transaksi_data?.iuran_tambahan?.map((it) => ({
              deskripsi: it.nama,
              nominal: it.nominal,
            })) || [];

            const strukData: StrukData = {
              idTransaksi: savedRecord.nomor_kuitansi || savedRecord.id,
              tipe: 'Syahriyah',
              namaPembayar: selectedSantri.nama,
              nisPembayar: selectedSantri.nis,
              kategoriPembayar: `Santri ${selectedSantri.kategori || 'Mukim'}`,
              tanggalBayar: savedRecord.transaksi_data?.tanggal_bayar || tanggalBayar,
              metode: savedRecord.transaksi_data?.metode || metode,
              items: strukItems,
              iuranTambahan: iuranTambahanItems,
              totalPembayaran: savedRecord.total_pembayaran,
              keterangan: savedRecord.transaksi_data?.keterangan || keterangan,
              rawRecord: savedRecord,
              santriObj: selectedSantri,
            };

            return (
              <StrukPembayaranCard
                data={strukData}
                onClose={onClose}
                onNewPayment={() => {
                  setIsSuccess(false);
                  setSavedRecord(null);
                  setItemInputs({});
                }}
              />
            );
          })()
        ) : (
          /* FORM VIEW */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-slate-50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Catat Pembayaran Syahriyah</h2>
                <p className="text-xs text-slate-500">
                  Mendukung pembayaran lintas tahun & pencatatan otomatis ke Buku Kas
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup modal"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content Body */}
            <form id="syahriyahPaymentForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Section 1: Santri Selector if initialSantri is null */}
              {!selectedSantri ? (
                <div className="space-y-3 bg-amber-50/60 border border-amber-200 p-4 rounded-xl">
                  <label className="block text-xs font-bold text-amber-900">
                    Pilih Santri Terlebih Dahulu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={santriSearch}
                      onChange={(e) => setSantriSearch(e.target.value)}
                      placeholder="Ketik nama atau NIS santri..."
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#059669] bg-white text-[#0F172A]"
                    />
                  </div>

                  {/* Picker Results Dropdown */}
                  {santriSearch.trim() && (
                    <div className="bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 shadow-md">
                      {filteredSantriPicker.length === 0 ? (
                        <p className="p-3 text-xs text-slate-500 text-center">Santri tidak ditemukan</p>
                      ) : (
                        filteredSantriPicker.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSantri(s);
                              setSantriSearch('');
                            }}
                            className="w-full text-left p-3 hover:bg-emerald-50 flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <span className="font-bold text-[#0F172A]">{s.nama}</span>
                              <span className="text-slate-400 ml-2">({s.nis})</span>
                            </div>
                            <span className="font-semibold text-[#059669] px-2 py-0.5 bg-emerald-100 rounded">
                              {s.kategori}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Santri Info Banner */
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#0F172A]">{selectedSantri.nama}</span>
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-200 text-slate-700">
                        {selectedSantri.nis}
                      </span>
                      <span className="px-2 py-0.5 rounded font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200">
                        {selectedSantri.kategori}
                      </span>
                    </div>
                    {hasilBulanTerpilih?.jenis && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {labelKeringanan(hasilBulanTerpilih)}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          potongan {formatRupiah(hasilBulanTerpilih.potongan)}/bulan
                        </span>
                      </div>
                    )}
                    <p className="text-slate-500">
                      Tarif Iuran: <strong className="text-slate-700">{formatRupiah(tarifBulan)}</strong> / bulan
                      {sisaBulanTerpilih != null && sisaBulanTerpilih !== tarifBulan && (
                        <span className="text-slate-500">
                          {' '}· Sisa: <strong className="text-slate-700">{formatRupiah(sisaBulanTerpilih)}</strong>
                        </span>
                      )}
                    </p>
                  </div>

                  {!initialSantri && (
                    <button
                      type="button"
                      onClick={() => setSelectedSantri(null)}
                      className="text-xs text-emerald-700 hover:underline font-semibold self-start sm:self-center"
                    >
                      Ganti Santri
                    </button>
                  )}
                </div>
              )}

              {selectedSantri && (
                <>
                  {/* Section 2: Year Nav & 12 Months Grid */}
                  <div className="space-y-3">
                    {/* Year Navigation Bar Centered */}
                    <div className="relative bg-slate-100/80 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-center gap-4 my-1">
                        <button
                          type="button"
                          onClick={() => setSelectedYear((y) => y - 1)}
                          className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                          title="Tahun Sebelumnya"
                          aria-label="Tahun Sebelumnya"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-lg text-sm font-bold text-[#0F172A]">
                          <Calendar className="w-4 h-4 text-[#059669] shrink-0" />
                          <span className="w-16 text-center font-mono">{selectedYear}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedYear((y) => y + 1)}
                          className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                          title="Tahun Berikutnya"
                          aria-label="Tahun Berikutnya"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Cross-Year Badge Indicator */}
                      {selectedKeysInOtherYearsCount > 0 && (
                        <div className="flex justify-center mt-2 sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2 sm:mt-0">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                            ({selectedKeysInOtherYearsCount} bulan di tahun lain)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 12 Months Grid for selectedYear */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {BULAN_FULL_NAMES.map((mName, idx) => {
                        const bulanNum = idx + 1;
                        const rec = currentYearRecords.find((r) => r.bulan === bulanNum);
                        const isLunas = rec?.status === 'Lunas';
                        const isBefore = selectedSantri ? isBeforeEntry(selectedSantri.tanggal_masuk, selectedYear, bulanNum) : false;
                        const isAfter = selectedSantri ? isSyahriyahSetelahKeluar(selectedSantri, selectedYear, bulanNum) : false;
                        const isOff = isBefore || isAfter;

                        const itemKey = `${selectedYear}-${bulanNum}`;
                        const isSelected = Boolean(itemInputs[itemKey]);

                        return (
                          <button
                            key={bulanNum}
                            type="button"
                            disabled={isLunas || isOff}
                            onClick={() => handleToggleMonth(bulanNum)}
                            className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                              isLunas || isOff
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : isSelected
                                ? 'bg-[#059669] text-white border-[#059669] shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-[#059669]'
                            }`}
                          >
                            <span className="font-bold">{mName.substring(0, 3)}</span>
                            {isLunas ? (
                              <span className="text-[10px] text-slate-400 font-normal">Lunas</span>
                            ) : isAfter ? (
                              <span className="text-[10px] text-slate-400 font-normal">Tidak Ditagih</span>
                            ) : isBefore ? (
                              <span className="text-[10px] text-slate-400 font-normal">Belum Masuk</span>
                            ) : rec?.status === 'Sebagian' ? (
                              <span
                                className={`text-[10px] ${
                                  isSelected ? 'text-emerald-100' : 'text-amber-600'
                                } font-bold`}
                              >
                                Sebagian
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] ${
                                  isSelected ? 'text-emerald-100' : 'text-slate-400'
                                } font-normal`}
                              >
                                Belum
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: Item Breakdown Form for All Selected Months Across Years */}
                  {selectedItemsList.length > 0 && (
                    <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Rincian Pembayaran Bulan Terpilih ({selectedItemsList.length} bulan)
                        </h3>
                      </div>

                      <div className="space-y-2.5 divide-y divide-slate-200/80">
                        {selectedItemsList.map((item) => {
                          const itemKey = `${item.tahun}-${item.bulan}`;
                          const mName = BULAN_FULL_NAMES[item.bulan - 1];

                          return (
                            <div
                              key={itemKey}
                              className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="w-36 font-bold text-[#0F172A] flex items-center gap-1.5">
                                <span>{mName} {item.tahun}</span>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200">
                                  <label className="flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                                    <input
                                      type="radio"
                                      name={`jenis_${itemKey}`}
                                      checked={item.jenis === 'Penuh'}
                                      onChange={() => handleJenisChange(itemKey, 'Penuh')}
                                      className="text-[#059669] focus:ring-[#059669]"
                                    />
                                    Penuh
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer font-medium text-slate-700 ml-2">
                                    <input
                                      type="radio"
                                      name={`jenis_${itemKey}`}
                                      checked={item.jenis === 'Sebagian'}
                                      onChange={() => handleJenisChange(itemKey, 'Sebagian')}
                                      className="text-[#059669] focus:ring-[#059669]"
                                    />
                                    Sebagian
                                  </label>
                                </div>

                                <div className="w-32">
                                  <input
                                    type="text"
                                    disabled={item.jenis === 'Penuh'}
                                    value={formatThousand(item.nominal)}
                                    onChange={(e) => handleNominalChange(itemKey, e.target.value)}
                                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded font-semibold text-right outline-none focus:border-[#059669] disabled:bg-slate-100 disabled:text-slate-600"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 4: Iuran Tambahan (Opsional) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">
                        Iuran Tambahan / Lainnya (Opsional)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddIuranLain}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#059669] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span> Tambah Iuran Lain</span>
                      </button>
                    </div>

                    {iuranTambahan.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <select
                          value={item.nama}
                          onChange={(e) => handleSelectIuranPreset(item.id, e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-[#059669] bg-white text-slate-800"
                        >
                          <option value="" disabled>-- Pilih Iuran Tambahan --</option>
                          {iuranTambahanOptions.map((opt) => (
                            <option key={opt.id || opt.nama} value={opt.nama}>
                              {opt.nama} (Rp {opt.nominal.toLocaleString('id-ID')})
                            </option>
                          ))}
                        </select>
                        <div className="w-32 relative">
                          <input
                            type="text"
                            placeholder="Nominal"
                            value={formatThousand(item.nominal)}
                            onChange={(e) => handleIuranLainChange(item.id, 'nominal', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none font-semibold text-right focus:border-[#059669]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveIuranLain(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Section 5: Detail Pembayaran */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="tanggalBayarSyahriyah" className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Bayar <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="tanggalBayarSyahriyah"
                        type="date"
                        value={tanggalBayar}
                        onChange={(e) => setTanggalBayar(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-[#059669]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Metode Pembayaran <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-3 pt-1 text-xs font-medium text-slate-700">
                        {(['Tunai', 'Transfer', 'Lainnya'] as const).map((m) => (
                          <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="metodeBayar"
                              checked={metode === m}
                              onChange={() => setMetode(m)}
                              className="text-[#059669] focus:ring-[#059669]"
                            />
                            {m}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ketSyahriyah" className="block text-xs font-semibold text-slate-700 mb-1">
                      Keterangan Tambahan (opsional)
                    </label>
                    <textarea
                      id="ketSyahriyah"
                      rows={2}
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      placeholder="Catatan kwitansi atau referensi transfer"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-[#059669]"
                    />
                  </div>

                  {/* Section 6: Checkbox Pernyataan Bendahara */}
                  <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-xl flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="pernyataanBendahara"
                      checked={isDeclared}
                      onChange={(e) => setIsDeclared(e.target.checked)}
                      className="mt-0.5 rounded border-emerald-400 text-[#059669] focus:ring-[#059669]"
                    />
                    <label htmlFor="pernyataanBendahara" className="text-xs text-emerald-900 font-medium cursor-pointer">
                      Saya (bendahara) menyatakan pembayaran ini telah diterima secara benar dan sah. Transaksi akan langsung tercatat ke Buku Kas Pondok.
                    </label>
                  </div>
                </>
              )}
            </form>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#E2E8F0] bg-slate-50 shrink-0">
              <div>
                <span className="text-xs text-slate-500 block">Total Pembayaran:</span>
                <span className="text-lg font-bold text-[#059669]">
                  {formatRupiah(totalPembayaran)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="syahriyahPaymentForm"
                  disabled={
                    isSubmitting ||
                    !selectedSantri ||
                    selectedItemsList.length === 0 ||
                    totalPembayaran <= 0 ||
                    !isDeclared
                  }
                  className="px-5 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition-colors shadow-xs inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SyahriyahPaymentModal;
