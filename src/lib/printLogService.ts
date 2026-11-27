import { storage } from './storage';
import { readJsonStrict } from './core';

export type PrintType = 'HVS' | 'Thermal' | 'PDF';

export interface PrintLogEntry {
  id: string;
  transaksi_id: string; // idTransaksi or nomor_kuitansi
  type: PrintType;
  printed_at: string; // YYYY-MM-DD HH:mm:ss
  printed_by?: string; // name or role
}

export interface TransactionPrintSummary {
  is_printed: boolean;
  print_count: number;
  last_printed_at?: string;
  last_print_type?: PrintType;
  logs: PrintLogEntry[];
}

const STORAGE_KEY = 'al_hidayah_print_logs';

let listeners: (() => void)[] = [];

export function subscribePrintLogs(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l());
}

export const printLogService = {
  getAllLogs(): Record<string, PrintLogEntry[]> {
    return readJsonStrict<Record<string, PrintLogEntry[]>>(STORAGE_KEY, {});
  },

  getLogs(transaksiId: string): PrintLogEntry[] {
    if (!transaksiId) return [];
    const all = this.getAllLogs();
    return all[transaksiId] || [];
  },

  getSummary(transaksiId: string): TransactionPrintSummary {
    const logs = this.getLogs(transaksiId);
    if (logs.length === 0) {
      return {
        is_printed: false,
        print_count: 0,
        logs: [],
      };
    }
    const last = logs[logs.length - 1];
    return {
      is_printed: true,
      print_count: logs.length,
      last_printed_at: last.printed_at,
      last_print_type: last.type,
      logs,
    };
  },

  addLog(transaksiId: string, type: PrintType, printedBy: string = 'Admin'): PrintLogEntry {
    if (!transaksiId) {
      throw new Error('transaksiId required for print log');
    }
    const all = this.getAllLogs();
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newEntry: PrintLogEntry = {
      id: `PLOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      transaksi_id: transaksiId,
      type,
      printed_at: formattedDate,
      printed_by: printedBy,
    };

    if (!all[transaksiId]) {
      all[transaksiId] = [];
    }
    all[transaksiId].push(newEntry);

    storage.setItem(STORAGE_KEY, JSON.stringify(all));
    notifyListeners();
    return newEntry;
  },

  clearLogs(transaksiId?: string) {
    if (transaksiId) {
      const all = this.getAllLogs();
      delete all[transaksiId];
      storage.setItem(STORAGE_KEY, JSON.stringify(all));
    } else {
      storage.removeItem(STORAGE_KEY);
    }
    notifyListeners();
  },
};
