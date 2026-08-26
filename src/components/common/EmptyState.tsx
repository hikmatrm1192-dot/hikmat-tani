/**
 * HIKMAT TANI - Empty State Component
 * 
 * Prinsip:
 * - Menghindari dashboard kosong dengan banyak widget membingungkan
 * - Memberi panduan tindakan utama yang jelas dan bersahabat
 */

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`p-6 sm:p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-1">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-slate-600 max-w-sm leading-relaxed">{description}</p>
      )}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 inline-flex items-center justify-center px-5 py-3 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-semibold rounded-xl text-sm transition-colors shadow-xs"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
