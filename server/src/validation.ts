import { badRequest } from './errors';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Tanggal kalender benar-benar valid (bukan sekadar lolos regex seperti 2026-99-99). */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export function isValidMonth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split('-').map(Number);
  return year >= 2000 && month >= 1 && month <= 12;
}

export function requireDate(value: unknown, label = 'Tanggal'): string {
  if (!isValidCalendarDate(value)) throw badRequest(`${label} tidak valid (gunakan YYYY-MM-DD)`);
  return value;
}

export function requireMonth(value: unknown, label = 'Periode bulan'): string {
  if (!isValidMonth(value)) throw badRequest(`${label} tidak valid (gunakan YYYY-MM)`);
  return value;
}

export function requirePositiveInteger(value: unknown, label = 'Nominal'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw badRequest(`${label} harus bilangan bulat lebih dari 0`);
  }
  return value;
}

export function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${label} wajib diisi`);
  return value.trim();
}

export function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${label} tidak valid`);
  }
  return value as T;
}

export function yearMonthFrom(date: string): string {
  return date.slice(0, 7);
}

/** Port dari src/lib/core.ts — aturan tagihan bulan sela tidak aktif. */
export function isBulanGapNonaktif(
  periods: Array<{ mulai: string; sampai?: string }>,
  tahun: number,
  bulan: number
): boolean {
  const target = `${tahun}-${pad2(bulan)}`;
  return periods.some((period) => {
    if (!isValidCalendarDate(period?.mulai)) return false;
    const mulai = yearMonthFrom(period.mulai);
    if (target <= mulai) return false;
    if (period.sampai && isValidCalendarDate(period.sampai)) {
      return target < yearMonthFrom(period.sampai);
    }
    return true;
  });
}

export function isAfterKeluar(tanggalKeluar: string | undefined, tahun: number, bulan: number): boolean {
  if (!tanggalKeluar || !isValidCalendarDate(tanggalKeluar)) return false;
  return `${tahun}-${pad2(bulan)}` > yearMonthFrom(tanggalKeluar);
}

export const EVENT_MONTH_MAP: Record<string, number> = {
  Romadhon: 3,
  Dzulhijjah: 6,
  Maulid: 9,
  'Jumadil Ula': 11,
};

export function isBeforeEntryEvent(tanggalMasuk: string, tahun: number, event: string): boolean {
  const matched = /^(\d{4})-(\d{2})/.exec(tanggalMasuk || '');
  if (!matched) return false;
  const entryYear = Number(matched[1]);
  const entryMonth = Number(matched[2]);
  if (tahun < entryYear) return true;
  if (tahun > entryYear) return false;
  return (EVENT_MONTH_MAP[event] || 1) < entryMonth;
}

export function isBulanDitagihkan(
  tanggalMasuk: string | undefined,
  tahun: number,
  bulan: number,
  tanggalKeluar?: string,
  periods: Array<{ mulai: string; sampai?: string }> = []
): boolean {
  const target = `${tahun}-${pad2(bulan)}`;
  if (target > new Date().toLocaleDateString('sv-SE').slice(0, 7)) return false; // WIB lokal
  if (tanggalMasuk && isValidCalendarDate(tanggalMasuk) && target < yearMonthFrom(tanggalMasuk)) {
    return false;
  }
  if (periods.length) return !isBulanGapNonaktif(periods, tahun, bulan);
  return !isAfterKeluar(tanggalKeluar, tahun, bulan);
}
