import React, { useEffect, useMemo, useState } from 'react';
import { Gift, Trash2, X } from 'lucide-react';
import { Santri } from '../../types/santri';
import { santriService } from '../../lib/santriService';
import { showToast } from '../../components/ui/Toast';
import { getTarifSyahriyah } from '../../lib/syahriyahService';
import { SantriPicker } from '../../components/ui/SantriPicker';
import { formatRupiah } from '../../lib/formatter';
import { SyahriyahWaiver, waiverService } from '../../lib/waiverService';

const BULAN_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
];

interface KeringananModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tahun: number;
}

export const KeringananModal: React.FC<KeringananModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tahun,
}) => {
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [santriId, setSantriId] = useState('');
  const [tahunInput, setTahunInput] = useState(tahun);
  const [bulanMulai, setBulanMulai] = useState(1);
  const [bulanSelesai, setBulanSelesai] = useState(12);
  const [nominalStr, setNominalStr] = useState('');
  const [jenis, setJenis] = useState<'kustom' | 'setengah' | 'penuh'>('kustom');
  const [tarifRentang, setTarifRentang] = useState({ min: 0, max: 0 });
  const [keterangan, setKeterangan] = useState('');
  const [waivers, setWaivers] = useState<SyahriyahWaiver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadWaivers = async (id: string, year: number) => {
    if (!id) {
      setWaivers([]);
      return;
    }
    try {
      setWaivers(await waiverService.getAll(id, year));
    } catch {
      showToast('Gagal memuat data keringanan', 'error');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTahunInput(tahun);
    setNominalStr('');
    setJenis('kustom');
    setIsLoading(true);
    santriService
      .getSantriList()
      .then((list) => {
        const eligible = list.filter((s) => s.kategori !== 'Kilatan');
        setSantriList(eligible);
        setSantriId((current) => current || eligible[0]?.id || '');
      })
      .catch(() => showToast('Gagal memuat daftar santri', 'error'))
      .finally(() => setIsLoading(false));
  }, [isOpen, tahun]);

  useEffect(() => {
    if (isOpen && santriId) void loadWaivers(santriId, tahunInput);
  }, [isOpen, santriId, tahunInput]);

  useEffect(() => {
    if (!isOpen || !santriId) return;
    const s = santriList.find((item) => item.id === santriId);
    if (!s) return;
    let active = true;
    const months: number[] = [];
    for (let b = bulanMulai; b <= bulanSelesai; b += 1) months.push(b);
    Promise.all(
      months.map((b) => getTarifSyahriyah(s.kategori, tahunInput, b))
    ).then((values) => {
      if (!active || values.length === 0) return;
      setTarifRentang({ min: Math.min(...values), max: Math.max(...values) });
    }).catch(() => {
      if (active) setTarifRentang({ min: 0, max: 0 });
    });
    return () => { active = false; };
  }, [isOpen, santriId, tahunInput, bulanMulai, bulanSelesai, santriList]);

  const nominal = Number(nominalStr.replace(/\D/g, ''));
  const nominalEfektif =
    jenis === 'penuh'
      ? tarifRentang.max
      : jenis === 'setengah'
        ? Math.round(tarifRentang.min / 2)
        : nominal;
  const bentrok = waivers.some(
    (w) => w.bulan_mulai <= bulanSelesai && w.bulan_selesai >= bulanMulai
  );
  const totalKeringanan = useMemo(
    () => nominalEfektif * Math.max(0, bulanSelesai - bulanMulai + 1),
    [nominalEfektif, bulanMulai, bulanSelesai]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!santriId) {
      showToast('Pilih santri terlebih dahulu', 'error');
      return;
    }
    if (!nominalEfektif || nominalEfektif <= 0) {
      showToast('Nominal keringanan harus lebih dari 0', 'error');
      return;
    }
    if (jenis === 'kustom' && nominal > tarifRentang.min) {
      showToast(
        `Nominal keringanan tidak boleh melebihi tarif berlaku (${formatRupiah(tarifRentang.min)})`,
        'error'
      );
      return;
    }
    setIsSaving(true);
    try {
      await waiverService.create({
        santri_id: santriId,
        tahun: tahunInput,
        bulan_mulai: bulanMulai,
        bulan_selesai: bulanSelesai,
        nominal_per_bulan: nominal,
        jenis,
        keterangan: keterangan.trim() || undefined,
      });
      showToast('Keringanan berhasil diberikan', 'success');
      setNominalStr('');
      setKeterangan('');
      await loadWaivers(santriId, tahunInput);
      onSuccess();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memberikan keringanan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHapus = async (id: string) => {
    try {
      // Histori lunas jadi bermuktahir: Cabut memotong periode (bulan
      // setelah bulan berjalan kembali tarif penuh); bulan lunas sebelumnya
      // tidak berubah (harga mati).
      const dariBulan = new Date().getMonth() + 1;
      await waiverService.hapus(id, dariBulan);
      showToast('Keringanan dicabut (histori lunas tidak berubah)', 'success');
      await loadWaivers(santriId, tahunInput);
      onSuccess();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mencabut keringanan', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] bg-white rounded-none sm:rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">Keringanan Syahriyah</h2>
            <p className="text-xs text-slate-500 mt-0.5">Khusus Super Admin — potong tagihan per bulan</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Santri</label>
            <SantriPicker
              santriList={santriList}
              value={santriId}
              onChange={setSantriId}
              disabled={isLoading}
              placeholder={
                isLoading ? 'Memuat daftar santri...' : 'Cari nama, NIS, atau kategori...'
              }
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {santriList.length} santri tersedia · gunakan ↑↓ lalu Enter untuk memilih
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun</label>
              <input
                type="number"
                value={tahunInput}
                onChange={(e) => setTahunInput(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bulan mulai</label>
              <select
                value={bulanMulai}
                onChange={(e) => setBulanMulai(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none"
              >
                {BULAN_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bulan selesai</label>
              <select
                value={bulanSelesai}
                onChange={(e) => setBulanSelesai(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none"
              >
                {BULAN_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis keringanan</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['kustom', 'Kustom'],
                ['setengah', '50%'],
                ['penuh', 'Penuh'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setJenis(value)}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    jenis === value
                      ? 'bg-[#059669] text-white border-[#059669]'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {jenis === 'kustom' ? 'Potongan per bulan (Rp)' : 'Potongan otomatis'}
            </label>
            {jenis === 'kustom' ? (
              <input
                type="text"
                inputMode="numeric"
                value={nominalStr}
                onChange={(e) => setNominalStr(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 100000"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#059669]"
              />
            ) : (
              <div className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                {jenis === 'penuh' ? 'Seluruh tarif' : 'Setengah dari tarif'} ·{' '}
                <strong>{formatRupiah(nominalEfektif)}</strong>/bulan
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              Total keringanan {formatRupiah(totalKeringanan)} untuk {Math.max(0, bulanSelesai - bulanMulai + 1)} bulan.
              {jenis === 'kustom' && tarifRentang.min > 0 && (
                <> Batas maksimal {formatRupiah(tarifRentang.min)}/bulan.</>
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan (opsional)</label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Mis. Keringanan karena kondisi ekonomi"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none"
            />
          </div>

          {bentrok && santriId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Santri ini sudah memiliki keringanan pada rentang bulan tersebut. Cabut keringanan lama atau pilih rentang lain.
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Keringanan aktif</p>
            {waivers.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada keringanan untuk santri & tahun ini.</p>
            ) : (
              <div className="space-y-2">
                {waivers.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        {BULAN_NAMES[w.bulan_mulai - 1]} – {BULAN_NAMES[w.bulan_selesai - 1]} {w.tahun}
                      </p>
                      <p className="text-slate-500">
                        {formatRupiah(w.nominal_per_bulan)}/bulan{w.keterangan ? ` • ${w.keterangan}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleHapus(w.id)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-red-200 text-red-600 text-[11px] font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Cabut
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0] bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            disabled={isLoading || isSaving || !santriId || bentrok}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#059669] text-white text-xs font-semibold disabled:opacity-50"
          >
            <Gift className="w-4 h-4" />
            {isSaving ? 'Menyimpan...' : 'Berikan Keringanan'}
          </button>
        </div>
      </div>
    </div>
  );
};
