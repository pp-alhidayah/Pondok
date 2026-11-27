import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Users, UserPlus, Wallet, HandCoins, CreditCard } from 'lucide-react';
import { santriService } from '../../lib/santriService';
import { pendaftaranService } from '../../lib/pendaftaranService';
import { kasService } from '../../lib/kasService';
import { iuranPembayaranService } from '../../lib/iuranPembayaranService';
import { syahriyahService } from '../../lib/syahriyahService';
import { kilatanService } from '../../lib/kilatanService';
import { formatRupiah } from '../../lib/formatter';

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  group: string;
  path: string;
}

export const SearchModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('Semua');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setFilterGroup('Semua');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setSearchError('');
    const q = query.toLowerCase().trim();

    const run = async () => {
      try {
        const [santri, pendaftaran, kas, iuran, syahTrax, kilTrax] = await Promise.all([
          santriService.getSantriList(),
          pendaftaranService.getPendaftaranList(),
          kasService.getKasList(),
          iuranPembayaranService.getAll(),
          syahriyahService.getTransaksiList(),
          kilatanService.getTransaksiList(),
        ]);

        const items: SearchResult[] = [];

        santri
          .filter((s) =>
            [s.nama, s.nis, s.nama_wali, s.no_hp_wali, s.no_hp_santri]
              .some((v) => v?.toString().toLowerCase().includes(q))
          )
          .slice(0, 10)
          .forEach((s) =>
            items.push({
              id: s.id,
              label: s.nama,
              sub: `NIS ${s.nis} · ${s.kategori}`,
              group: 'Santri',
              path: `/santri/${s.id}`,
            })
          );

        pendaftaran
          .filter((p) =>
            [p.nama_calon, p.nama_wali, p.no_hp_santri, p.no_hp_wali]
              .some((v) => v?.toString().toLowerCase().includes(q))
          )
          .slice(0, 10)
          .forEach((p) =>
            items.push({
              id: p.id,
              label: p.nama_calon,
              sub: `Pendaftaran · ${p.status}`,
              group: 'Pendaftaran',
              path: '/pendaftaran',
            })
          );

        kas
          .filter((k) =>
            [k.keterangan, k.kategori_nama]
              .some((v) => v?.toString().toLowerCase().includes(q))
          )
          .slice(0, 10)
          .forEach((k) =>
            items.push({
              id: k.id,
              label: k.keterangan || k.kategori_nama,
              sub: `${k.kategori_nama} · ${k.jenis} · Rp ${k.nominal.toLocaleString('id-ID')}`,
              group: 'Kas',
              path: '/kas',
            })
          );

        iuran
          .filter((i) =>
            [i.nama_pembayar, i.iuran_nama, i.keterangan]
              .some((v) => v?.toString().toLowerCase().includes(q))
          )
          .slice(0, 10)
          .forEach((i) =>
            items.push({
              id: i.id,
              label: i.nama_pembayar,
              sub: `${i.iuran_nama} · Rp ${i.nominal.toLocaleString('id-ID')}`,
              group: 'Iuran',
              path: '/iuran',
            })
          );

        syahTrax
          .filter((r) =>
            [r.santri_nama, r.santri_nis, r.nomor_kuitansi]
              .some((v) => v?.toString().toLowerCase().includes(q))
          )
          .slice(0, 10)
          .forEach((r) =>
            items.push({
              id: r.id,
              label: r.santri_nama,
              sub: `Syahriyah · ${r.nomor_kuitansi || r.id}`,
              group: 'Syahriyah',
              path: '/syahriyah',
            })
          );

        kilTrax
          .filter((r) =>
            [r.santri_nama, r.santri_nis, r.nomor_kuitansi]
              .some((v) => v?.toString().toLowerCase().includes(q))
          )
          .slice(0, 10)
          .forEach((r) =>
            items.push({
              id: r.id,
              label: r.santri_nama,
              sub: `Kilatan · ${r.nomor_kuitansi || r.id}`,
              group: 'Kilatan',
              path: '/kilatan',
            })
          );

        if (!active) return [];
        if (filterGroup !== 'Semua') {
          return items.filter((i) => i.group === filterGroup);
        }
        return items;
      } catch {
        if (active) setSearchError('Gagal memuat data pencarian. Coba lagi.');
        return [];
      } finally {
        if (active) setLoading(false);
      }
    };

    void run().then((items) => {
      if (active) setResults(items);
    });
    return () => {
      active = false;
    };
  }, [query, filterGroup]);

  const groups = useMemo(
    () => ['Semua', ...Array.from(new Set(results.map((r) => r.group)))],
    [results]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((v) => Math.min(v + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((v) => Math.max(v - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = results[selectedIndex];
        if (item) {
          navigate(item.path);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, results, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  const groupIcons: Record<string, React.ReactNode> = {
    Santri: <Users className="w-4 h-4 text-blue-500" />,
    Pendaftaran: <UserPlus className="w-4 h-4 text-purple-500" />,
    Kas: <Wallet className="w-4 h-4 text-emerald-500" />,
    Iuran: <HandCoins className="w-4 h-4 text-orange-500" />,
    Syahriyah: <CreditCard className="w-4 h-4 text-rose-500" />,
    Kilatan: <CreditCard className="w-4 h-4 text-slate-500" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 p-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[80vh] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari santri, pendaftaran, kas, iuran, syahriyah, kilatan..."
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder-slate-400"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
            aria-label="Tutup pencarian"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {groups.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 overflow-x-auto">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                  filterGroup === g
                    ? 'bg-[#059669] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              Mencari...
            </div>
          ) : !query.trim() ? (
            <div className="px-4 py-12 text-center">
              <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                Ketik nama santri, NIS, keterangan kas, atau nomor kuitansi…
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Gunakan ↑↓ untuk memilih, Enter untuk membuka
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-rose-600">{searchError || `Tidak ada hasil untuk "${query}"`}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((item, index) => (
                <li
                  key={`${item.group}-${item.id}-${index}`}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                    selectedIndex === index ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                >
                  <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                    {groupIcons[item.group]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
                    <p className="text-[11px] text-slate-500 truncate">{item.sub}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    {item.group}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
