import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Users } from 'lucide-react';
import { Santri } from '../../types/santri';

interface SantriPickerProps {
  santriList: Santri[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Combobox santri: cari nama/NIS/kategori, navigasi keyboard, dan chip terpilih. */
export const SantriPicker: React.FC<SantriPickerProps> = ({
  santriList,
  value,
  onChange,
  placeholder = 'Cari nama, NIS, atau kategori...',
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(
    () => santriList.find((s) => s.id === value) || null,
    [santriList, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return santriList;
    return santriList.filter((s) =>
      `${s.nama} ${s.nis} ${s.kategori}`.toLowerCase().includes(q)
    );
  }, [santriList, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const pilih = (santri: Santri) => {
    onChange(santri.id);
    setQuery('');
    setOpen(false);
  };

  const bersihkan = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((v) => Math.min(v + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((v) => Math.max(v - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[highlight];
      if (item) pilih(item);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="santri-picker-list"
          value={open ? query : selected ? `${selected.nama} (${selected.nis})` : ''}
          placeholder={selected && !open ? '' : placeholder}
          disabled={disabled}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#059669] disabled:opacity-50 disabled:bg-slate-50"
        />
        {(query || selected) && !disabled && (
          <button
            type="button"
            onClick={bersihkan}
            aria-label="Hapus pilihan santri"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div
          id="santri-picker-list"
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Tidak ada santri cocok</p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-2 text-[11px] font-semibold text-[#059669] hover:underline"
              >
                Hapus pencarian
              </button>
            </div>
          ) : (
            filtered.map((s, index) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={value === s.id}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pilih(s)}
                className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-b border-slate-100 last:border-b-0 ${
                  highlight === index ? 'bg-emerald-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.nama}</p>
                  <p className="text-[11px] text-slate-500">
                    {s.nis} · {s.kategori}
                  </p>
                </div>
                {value === s.id && (
                  <span className="text-[10px] font-bold text-[#059669] uppercase shrink-0">
                    Dipilih
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
