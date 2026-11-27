import React from 'react';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

export interface StatusPillProps {
  tone: StatusTone;
  children: React.ReactNode;
  size?: 'sm' | 'xs';
  className?: string;
}

/** Status pill terpusat agar warna status konsisten di seluruh halaman. */
export const StatusPill: React.FC<StatusPillProps> = ({
  tone,
  children,
  size = 'sm',
  className = '',
}) => (
  <span
    className={`inline-flex items-center rounded-md border font-semibold whitespace-nowrap ${
      size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[11px]'
    } ${toneClasses[tone]} ${className}`}
  >
    {children}
  </span>
);

export default StatusPill;
