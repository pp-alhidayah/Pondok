import React, { useEffect, useId, useState } from 'react';
import { Filter, X } from 'lucide-react';

interface ResponsiveFilterSheetProps {
  title: string;
  description?: string;
  activeFilterCount?: number;
  onOpen?: () => void;
  onApply?: () => void;
  children: React.ReactNode;
  buttonClassName?: string;
}

export const ResponsiveFilterSheet: React.FC<ResponsiveFilterSheetProps> = ({
  title,
  description = 'Atur filter yang ingin digunakan',
  activeFilterCount = 0,
  onOpen,
  onApply,
  children,
  buttonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const openSheet = () => {
    onOpen?.();
    setIsOpen(true);
  };

  const applyAndClose = () => {
    onApply?.();
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:h-11 lg:hidden ${buttonClassName}`}
      >
        <Filter aria-hidden="true" className="h-4 w-4" />
        <span>Filter</span>
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1 text-xs font-semibold text-emerald-700">
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-950/40 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
            aria-label="Tutup filter"
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[85dvh] space-y-5 overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup filter"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">{children}</div>

            <div className="flex gap-3 border-t border-slate-100 pt-4">
              {onApply ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={applyAndClose}
                    className="h-11 flex-1 rounded-xl bg-[#059669] text-sm font-semibold text-white transition-colors hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    Terapkan
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="h-11 flex-1 rounded-xl bg-[#059669] text-sm font-semibold text-white transition-colors hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  Selesai
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
};
