import React, { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, Search, SearchX } from 'lucide-react';
import {
  ACTIVITY_LOG_KEY,
  ActivityLogEntry,
  ActivityModul,
  activityLogService,
} from '../../lib/activityLogService';
import { EmptyState } from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/Toast';

const MODUL_OPTIONS: Array<ActivityModul | 'Semua'> = [
  'Semua',
  'Santri',
  'Pendaftaran',
  'Syahriyah',
  'Kilatan',
  'Iuran',
  'Kas',
  'Pengaturan',
  'Sistem',
];

const AKSI_STYLE: Record<string, string> = {
  Tambah: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Impor: 'bg-teal-50 text-teal-700 border-teal-200',
  Pembayaran: 'bg-blue-50 text-blue-700 border-blue-200',
  Ubah: 'bg-amber-50 text-amber-700 border-amber-200',
  Restore: 'bg-violet-50 text-violet-700 border-violet-200',
  Pembatalan: 'bg-orange-50 text-orange-700 border-orange-200',
  Hapus: 'bg-red-50 text-red-700 border-red-200',
  Login: 'bg-slate-100 text-slate-700 border-slate-200',
};

function formatWaktu(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AktivitasPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterModul, setFilterModul] = useState<ActivityModul | 'Semua'>('Semua');

  const load = () => {
    try {
      setLogs(activityLogService.getAll());
    } catch {
      showToast('Gagal memuat riwayat aktivitas', 'error');
    }
  };

  useEffect(() => {
    load();
    // Muat ulang saat tab lain mengubah riwayat.
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_LOG_KEY) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (filterModul !== 'Semua' && log.modul !== filterModul) return false;
      if (!q) return true;
      return (
        log.deskripsi.toLowerCase().includes(q) ||
        log.modul.toLowerCase().includes(q) ||
        log.aksi.toLowerCase().includes(q) ||
        (log.user || '').toLowerCase().includes(q)
      );
    });
  }, [logs, search, filterModul]);

  const resetFilter = () => {
    setSearch('');
    setFilterModul('Semua');
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Riwayat Aktivitas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Catatan {logs.length} aktivitas terakhir — hanya 500 entri terbaru yang disimpan
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium transition-colors shadow-xs"
        >
          <History className="w-4 h-4 text-slate-500" />
          Muat Ulang
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari deskripsi, modul, aksi, atau user..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-[#0F172A]"
            />
          </div>

          <div>
            <select
              value={filterModul}
              onChange={(e) => setFilterModul(e.target.value as ActivityModul | 'Semua')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-slate-700"
            >
              {MODUL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 'Semua' ? 'Semua Modul' : m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-start sm:justify-end">
            <button
              type="button"
              onClick={resetFilter}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors rounded-lg hover:bg-slate-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={<SearchX className="w-10 h-10" />}
              title={logs.length === 0 ? 'Belum ada aktivitas' : 'Tidak ada aktivitas cocok'}
              description={
                logs.length === 0
                  ? 'Aktivitas tambah, ubah, hapus, dan pembayaran akan tercatat otomatis di sini.'
                  : 'Coba ubah kata kunci atau filter modul.'
              }
              actionLabel={logs.length === 0 ? undefined : 'Reset Filter'}
              onAction={logs.length === 0 ? undefined : resetFilter}
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-semibold uppercase text-slate-500">
                    <th className="px-4 py-3 whitespace-nowrap">Waktu</th>
                    <th className="px-4 py-3">Modul</th>
                    <th className="px-4 py-3">Aksi</th>
                    <th className="px-4 py-3">Deskripsi</th>
                    <th className="px-4 py-3">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatWaktu(log.waktu)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {log.modul}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            AKSI_STYLE[log.aksi] || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {log.aksi}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{log.deskripsi}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{log.user || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {log.modul}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatWaktu(log.waktu)}</span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium">{log.deskripsi}</p>
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        AKSI_STYLE[log.aksi] || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {log.aksi}
                    </span>
                    <span className="text-[11px] text-slate-500">{log.user || '—'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-[#E2E8F0] bg-slate-50/50 text-xs text-slate-500">
              Menampilkan {filtered.length} aktivitas
              {filtered.length !== logs.length && ` dari ${logs.length} tercatat`}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AktivitasPage;
