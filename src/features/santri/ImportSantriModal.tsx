import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { parseSantriImportRows, SantriImportError, SantriImportRow } from '../../lib/santriImport';
import { santriService } from '../../lib/santriService';
import { showToast } from '../../components/ui/Toast';

interface ImportSantriModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TEMPLATE_HEADERS = [
  'NIS',
  'Nama Santri',
  'Nama Wali',
  'No HP Santri',
  'No HP Wali',
  'Kategori',
  'Status',
  'Tanggal Masuk',
  'Catatan',
];

export const ImportSantriModal: React.FC<ImportSantriModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<SantriImportRow[]>([]);
  const [errors, setErrors] = useState<SantriImportError[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFileName('');
      setRows([]);
      setErrors([]);
      setIsParsing(false);
      setIsImporting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    try {
      const ws = XLSX.utils.json_to_sheet([
        {
          NIS: '',
          'Nama Santri': 'Ahmad Fauzi',
          'Nama Wali': 'Bapak Fauzi',
          'No HP Santri': '081234567890',
          'No HP Wali': '081234567891',
          Kategori: 'Mukim',
          Status: 'Aktif',
          'Tanggal Masuk': '2026-01-05',
          Catatan: '',
        },
      ]);
      ws['!cols'] = [
        { wch: 12 },
        { wch: 24 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 24 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Santri');
      XLSX.writeFile(wb, 'Template-Import-Santri.xlsx');
      showToast('Template impor berhasil diunduh', 'success');
    } catch {
      showToast('Gagal membuat template impor', 'error');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error('Sheet tidak ditemukan');
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });

      const parsed = parseSantriImportRows(raw);
      setFileName(file.name);
      setRows(parsed.rows);
      setErrors(parsed.errors);

      if (parsed.rows.length === 0) {
        showToast('Tidak ada baris valid pada file. Periksa nama kolom dan isinya.', 'error');
      } else {
        showToast(`${parsed.rows.length} baris siap diimpor`, 'info');
      }
    } catch {
      showToast('Gagal membaca file. Pastikan format Excel/CSV valid.', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0 || isImporting) return;
    setIsImporting(true);
    try {
      const result = await santriService.importSantri(rows.map((r) => r.data));
      showToast(
        `${result.jumlah} santri berhasil diimpor${errors.length ? `, ${errors.length} baris dilewati` : ''}`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengimpor data santri', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-white h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">Impor Data Santri</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Unggah file Excel (.xlsx/.xls) atau CSV sesuai template
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {rows.length === 0 ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 hover:border-[#059669] hover:bg-emerald-50/40 rounded-2xl p-8 text-center transition-colors"
              >
                <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#0F172A]">
                  {isParsing ? 'Membaca file...' : 'Klik untuk memilih file Excel / CSV'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Kolom wajib: Nama Santri. NIS boleh dikosongkan (dibuat otomatis).
                </p>
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Belum punya format?</p>
                  <p>Unduh template agar nama kolom terbaca otomatis.</p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Unduh Template
                </button>
              </div>

              {errors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{errors.length} baris tidak valid (tidak akan diimpor)</span>
                  </div>
                  <ul className="text-xs text-amber-700 list-disc pl-5 space-y-1">
                    {errors.slice(0, 5).map((err) => (
                      <li key={`${err.row}-${err.message}`}>
                        Baris {err.row}: {err.message}
                      </li>
                    ))}
                    {errors.length > 5 && <li>... dan {errors.length - 5} baris lainnya</li>}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 text-sm text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    {fileName} — {rows.length} baris siap diimpor
                    {errors.length > 0 && `, ${errors.length} baris dilewati`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Ganti File
                </button>
              </div>

              {errors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Baris yang dilewati</span>
                  </div>
                  <ul className="text-xs text-amber-700 list-disc pl-5 space-y-1">
                    {errors.slice(0, 5).map((err) => (
                      <li key={`${err.row}-${err.message}`}>
                        Baris {err.row}: {err.message}
                      </li>
                    ))}
                    {errors.length > 5 && <li>... dan {errors.length - 5} baris lainnya</li>}
                  </ul>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-slate-500 uppercase font-semibold">
                        <th className="px-3 py-2">Baris</th>
                        <th className="px-3 py-2">NIS</th>
                        <th className="px-3 py-2">Nama</th>
                        <th className="px-3 py-2">Kategori</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Tgl Masuk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r) => (
                        <tr key={r.row} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-slate-400">{r.row}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">
                            {r.data.nis || <span className="text-emerald-600">otomatis</span>}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">{r.data.nama}</td>
                          <td className="px-3 py-2 text-slate-600">{r.data.kategori}</td>
                          <td className="px-3 py-2 text-slate-600">{r.data.status}</td>
                          <td className="px-3 py-2 text-slate-600">{r.data.tanggal_masuk || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0] bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={rows.length === 0 || isParsing || isImporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            {isImporting ? 'Mengimpor...' : `Impor ${rows.length} Santri`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportSantriModal;
