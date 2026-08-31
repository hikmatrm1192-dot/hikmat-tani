/**
 * HIKMAT TANI - Page Header Component
 */

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 ${className}`}>
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 leading-relaxed max-w-3xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
