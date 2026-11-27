import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  colSpan?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title = 'Belum ada data',
  description,
  actionLabel,
  onAction,
  colSpan,
}) => {
  const inner = (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {icon && <div className="text-slate-300 mb-3">{icon}</div>}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );

  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan}>{inner}</td>
      </tr>
    );
  }

  return <div>{inner}</div>;
};

export default EmptyState;
