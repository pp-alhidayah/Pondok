import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** Header halaman standar: judul, deskripsi singkat, dan area aksi kanan. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">{title}</h1>
      {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>}
  </div>
);

export default PageHeader;
