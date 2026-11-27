import React, { useState, useEffect } from 'react';
import { Printer, Clock, History, X, CheckCircle2, FileText, Download } from 'lucide-react';
import { printLogService, subscribePrintLogs, TransactionPrintSummary, PrintType } from '../../lib/printLogService';

interface PrintStatusBadgeProps {
  transaksiId: string;
  compact?: boolean;
  showHistoryButton?: boolean;
}

export const PrintStatusBadge: React.FC<PrintStatusBadgeProps> = ({
  transaksiId,
  compact = false,
  showHistoryButton = true,
}) => {
  const [summary, setSummary] = useState<TransactionPrintSummary>(() =>
    printLogService.getSummary(transaksiId)
  );
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setSummary(printLogService.getSummary(transaksiId));
    const unsubscribe = subscribePrintLogs(() => {
      setSummary(printLogService.getSummary(transaksiId));
    });
    return unsubscribe;
  }, [transaksiId]);

  const getIconForType = (type: PrintType) => {
    switch (type) {
      case 'HVS':
        return <FileText className="w-3.5 h-3.5 text-blue-600" />;
      case 'Thermal':
        return <Printer className="w-3.5 h-3.5 text-purple-600" />;
      case 'PDF':
        return <Download className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <Printer className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  if (compact) {
    return (
      <>
        <div className="inline-flex items-center gap-1.5">
          {summary.is_printed ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-medium transition-colors cursor-pointer"
              title="Klik untuk melihat riwayat cetak"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Sudah Dicetak ({summary.print_count}x)</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Belum Dicetak</span>
            </span>
          )}
        </div>

        {modalOpen && (
          <PrintHistoryModal
            transaksiId={transaksiId}
            summary={summary}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          {summary.is_printed ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              Sudah Dicetak ({summary.print_count}x)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Belum Dicetak
            </span>
          )}
          {summary.last_printed_at && (
            <span className="text-slate-500 text-[11px] hidden sm:inline">
              Terakhir: <strong>{summary.last_print_type}</strong> ({summary.last_printed_at})
            </span>
          )}
        </div>

        {showHistoryButton && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer shadow-2xs"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Riwayat Cetak ({summary.print_count})</span>
          </button>
        )}
      </div>

      {modalOpen && (
        <PrintHistoryModal
          transaksiId={transaksiId}
          summary={summary}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
};

interface PrintHistoryModalProps {
  transaksiId: string;
  summary: TransactionPrintSummary;
  onClose: () => void;
}

export const PrintHistoryModal: React.FC<PrintHistoryModalProps> = ({
  transaksiId,
  summary,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Printer className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Riwayat Log Cetak Struk
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                No. Transaksi: {transaksiId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {summary.logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 space-y-2">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs">Struk ini belum pernah dicetak atau diunduh.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 mb-2 font-medium">
                Total pencetakan: <strong>{summary.print_count} kali</strong>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {summary.logs.map((log, idx) => (
                  <div key={log.id || idx} className="p-3 bg-white hover:bg-slate-50/80 flex items-center justify-between text-xs transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                        {log.type === 'HVS' ? (
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        ) : log.type === 'Thermal' ? (
                          <Printer className="w-3.5 h-3.5 text-purple-600" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>Format Cetak: {log.type}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Oleh: {log.printed_by || 'Admin'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-500 font-mono">
                      {log.printed_at}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
