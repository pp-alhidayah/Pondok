import React, { useEffect, useMemo, useState } from 'react';
import { Search, SearchX, ArrowRight, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Santri } from '../../types/santri';
import { EmptyState } from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/Toast';
import { santriService } from '../../lib/santriService';
import { waiverService, SyahriyahWaiver } from '../../lib/waiverService';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusPill } from '../../components/ui/StatusPill';
import { authStore, AuthUser } from '../../store/authStore';
import { KeringananModal } from '../syahriyah/KeringananModal';

const BULAN_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
];

function formatPeriode(w: SyahriyahWaiver): string {
  return `${BULAN_NAMES[w.bulan_mulai - 1]} – ${BULAN_NAMES[w.bulan_selesai - 1]} ${w.tahun}`;
}

function formatKeringananLabel(w: Pick<SyahriyahWaiver, 'jenis' | 'nominal_per_bulan'>): string {
  if (w.jenis === 'penuh') return 'Keringanan Penuh';
  if (w.jenis === 'setengah') return 'Keringanan 50%';
  return `Keringanan Rp ${(w.nominal_per_bulan || 0).toLocaleString('id-ID')}`;
}

export const KeringananSantriListPage: React.FC = () => {
  const navigate = useNavigate();
  const [waivers, setWaivers] = useState<SyahriyahWaiver[]>([]);
  const [santriById, setSantriById] = useState<Record<string, Santri>>({});
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const isSuperAdmin = user?.role === 'super_admin';
  const [keringananOpen, setKeringananOpen] = useState(false);

  useEffect(() => {
    authStore.getUser().then(setUser);
  }, []);

  const reloadWaivers = async () => {
    try {
      setWaivers(await waiverService.getAll());
    } catch {
      // daftar sebelumnya tetap tampil
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([waiverService.getAll(), santriService.getSantriList()])
      .then(([waiversList, santris]) => {
        if (!active) return;
        setWaivers(waiversList);
        const byId: Record<string, Santri> = {};
        santris.forEach((s) => { byId[s.id] = s; });
        setSantriById(byId);
      })
      .catch(() => showToast('Gagal memuat daftar keringanan', 'error'))
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  // Reset halaman saat pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return waivers
      .slice()
      .sort((a, b) =>
        (santriById[a.santri_id]?.nama || a.santri_id)
          .localeCompare(santriById[b.santri_id]?.nama || b.santri_id)
      )
      .filter((w) => !q || (santriById[w.santri_id]?.nama || '').toLowerCase().includes(q));
  }, [waivers, santriById, search]);

  const uniqueSantris = useMemo(
    () => new Set(waivers.map((w) => w.santri_id)).size,
    [waivers]
  );

  const totalFiltered = rows.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);
  const startItem = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalFiltered);

  // Jika data menyusut, jangan biarkan halaman aktif melewati batas.
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Santri dengan Keringanan"
        description={`${waivers.length} santri mendapat keringanan Syahriyah`}
        actions={
          <>
            {isSuperAdmin && (
              <Button variant="primary" leftIcon={<Gift className="w-4 h-4" />} onClick={() => setKeringananOpen(true)}>
                Berikan Keringanan
              </Button>
            )}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari santri..."
                aria-label="Cari nama santri"
                className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] bg-white text-[#0F172A]"
              />
            </div>
          </>
        }
      />

      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">Memuat data...</div>
        ) : rows.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={<SearchX className="w-10 h-10" />}
              title="Belum ada keringanan"
              description={
                waivers.length === 0
                  ? 'Santri belum mendapat keringanan syahriyah. Klik "Keringanan" di halaman Syahriyah untuk memberikannya.'
                  : 'Cari nama santri tidak ditemukan.'
              }
              actionLabel={waivers.length === 0 ? 'Ke Halaman Syahriyah' : undefined}
              onAction={waivers.length === 0 ? () => navigate('/syahriyah') : undefined}
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-semibold uppercase text-slate-500">
                    <th className="px-4 py-3 whitespace-nowrap">Santri</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Keringanan</th>
                    <th className="px-4 py-3">Rentang</th>
                    <th className="px-4 py-3 whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedRows.map((w) => {
                    const s = santriById[w.santri_id];
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-[#0F172A]">{s?.nama || w.santri_id}</p>
                          <p className="text-xs text-slate-500 font-mono">{s?.nis || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{s?.kategori || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone="warning">{formatKeringananLabel(w)}</StatusPill>
                          {w.keterangan && (
                            <p className="text-xs text-slate-500 mt-1 max-w-[200px] truncate">
                              {w.keterangan}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{formatPeriode(w)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => navigate('/syahriyah')}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#059669] hover:underline"
                          >
                            Lihat
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {paginatedRows.map((w) => {
                const s = santriById[w.santri_id];
                return (
                  <div key={w.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-[#0F172A]">{s?.nama || w.santri_id}</span>
                      <StatusPill tone="warning">{formatKeringananLabel(w)}</StatusPill>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {s?.kategori || '—'}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-slate-600">{s?.nis || '—'}</span>
                      <span>•</span>
                      <span>{formatPeriode(w)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/syahriyah')}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#059669] hover:underline"
                    >
                      Ke Syahriyah <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 bg-slate-50/50">
              <div>
                Menampilkan <span className="font-semibold text-[#0F172A]">{startItem}-{endItem}</span> dari{' '}
                <span className="font-semibold text-[#0F172A]">{totalFiltered}</span> keringanan ·{' '}
                <span className="font-semibold text-[#0F172A]">{uniqueSantris}</span> santri total
              </div>

              <Pagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={totalFiltered}
                label="keringanan"
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </div>

      {isSuperAdmin && (
        <KeringananModal
          isOpen={keringananOpen}
          onClose={() => setKeringananOpen(false)}
          onSuccess={reloadWaivers}
          tahun={new Date().getFullYear()}
        />
      )}
    </div>
  );
};

export default KeringananSantriListPage;
