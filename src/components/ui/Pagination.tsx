import React from 'react';

export interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  /** Digunakan untuk aria-label tombol navigasi. */
  label?: string;
}

/**
 * Kontrol pagination standar: ukuran halaman + Prev/nomor/Next.
 * Info "Menampilkan x-y dari n" tetap ditulis halaman karena konteksnya beda-beda.
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  label = 'halaman',
}) => {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span>Per halaman:</span>
        <select
          aria-label="Jumlah data per halaman"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700 outline-none focus:border-[#059669] cursor-pointer"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      <nav aria-label={`Navigasi ${label}`} className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`${label} sebelumnya`}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
        >
          Prev
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            aria-label={`${label} ${p}`}
            aria-current={currentPage === p ? 'page' : undefined}
            onClick={() => onPageChange(p)}
            className={`w-7 h-7 rounded-md font-medium text-xs flex items-center justify-center transition-colors cursor-pointer ${
              currentPage === p
                ? 'bg-[#059669] text-white font-bold'
                : 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          aria-label={`${label} berikutnya`}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
        >
          Next
        </button>
      </nav>
    </div>
  );
};

export default Pagination;
