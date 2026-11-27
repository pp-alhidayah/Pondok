import React, { useEffect } from 'react';
import { UserCheck, UserX, Calendar, Info } from 'lucide-react';
import { Santri } from '../../types/santri';
import { todayLocal } from '../../lib/core';

/**
 * Modal konfirmasi perubahan status santri (Aktif <-> Tidak Aktif).
 * Menjelaskan konsekuensi tagihan sebelum tindakan dijalankan.
 */
interface StatusToggleConfirmModalProps {
  santri: Santri | null;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const StatusToggleConfirmModal: React.FC<StatusToggleConfirmModalProps> = ({
  santri,
  isLoading,
  onConfirm,
  onClose,
}) => {
  // Tutup dengan tombol ESC
  useEffect(() => {
    if (!santri) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [santri, isLoading, onClose]);

  if (!santri) return null;

  const jadiTidakAktif = santri.status === 'Aktif';
  const hariIni = todayLocal();
  const periodeTerbuka = (santri.periode_nonaktif || []).find((p) => !p.sampai);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Konfirmasi perubahan status santri"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={() => !isLoading && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                jadiTidakAktif ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {jadiTidakAktif ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">
                {jadiTidakAktif ? 'Nonaktifkan Santri' : 'Aktifkan Kembali Santri'}
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                {santri.nama} • {santri.nis}
              </p>
            </div>
          </div>
          <button
            onClick={() => !isLoading && onClose()}
            aria-label="Tutup"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Konsekuensi */}
        {jadiTidakAktif ? (
          <>
            <p className="text-sm text-slate-600">
              Yakin ingin menonaktifkan santri ini? Berikut konsekuensinya terhadap tagihan:
            </p>
            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-start gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  Tanggal keluar otomatis terisi <strong>tanggal hari ini ({hariIni})</strong> dan bisa diubah
                  lewat tombol <strong>Edit</strong> setelah ini.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  Bulan tanggal keluar <strong>masih ditagih</strong>; bulan setelahnya{' '}
                  <strong>tidak ditagih</strong> sampai santri diaktifkan kembali.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>Riwayat pembayaran dan tagihan lama tetap tersimpan tanpa perubahan.</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Yakin ingin mengaktifkan kembali santri ini? Berikut konsekuensinya terhadap tagihan:
            </p>
            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-start gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  {periodeTerbuka ? (
                    <>
                      Periode tidak aktif sejak{' '}
                      <strong>{periodeTerbuka.mulai}</strong> ditutup dengan tanggal{' '}
                      <strong>hari ini ({hariIni})</strong>.
                    </>
                  ) : (
                    <>
                      Tanggal aktif kembali: <strong>{hariIni}</strong>.
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  Bulan-bulan di sela masa tidak aktif <strong>tidak ditagih</strong> dan tetap
                  tidak ditagih setelahnya (tidak menjadi tunggakan).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  Bulan <strong>bulan ini ditagih lagi</strong> sejak tanggal pengaktifan.
                </span>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => !isLoading && onClose()}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-white text-xs font-semibold transition-colors shadow-xs inline-flex items-center gap-2 disabled:opacity-60 ${
              jadiTidakAktif
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Memproses...</span>
              </>
            ) : jadiTidakAktif ? (
              <span>Ya, Nonaktifkan</span>
            ) : (
              <span>Ya, Aktifkan Kembali</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusToggleConfirmModal;
