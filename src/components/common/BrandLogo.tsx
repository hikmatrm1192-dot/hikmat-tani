/**
 * HIKMAT TANI - Brand Logo & Identity Component
 * 
 * Slogan Resmi: "Cerdas Bertani, Bijak Mengambil Keputusan"
 */

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSlogan?: boolean;
  className?: string;
  variant?: 'light' | 'dark';
}

export function BrandLogo({
  size = 'md',
  showSlogan = false,
  className = '',
  variant = 'dark',
}: BrandLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const titleSizes = {
    sm: 'text-base font-bold',
    md: 'text-lg font-extrabold',
    lg: 'text-2xl font-black',
  };

  const isLight = variant === 'light';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Visual Icon: Rice Stalk & Wisdom Motif */}
      <div
        className={`${iconSizes[size]} rounded-xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 flex items-center justify-center shadow-xs border border-emerald-600/30 text-amber-400 shrink-0`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3/5 h-3/5"
        >
          {/* Rice Stalk & Leaves */}
          <path d="M12 2v20" stroke="#f59e0b" />
          <path d="M12 6c-3-2-6-1-7 2 2 3 5 2 7-2Z" fill="#10b981" stroke="#34d399" />
          <path d="M12 11c3-2 6-1 7 2-2 3-5 2-7-2Z" fill="#059669" stroke="#6ee7b7" />
          <path d="M12 15c-3-2-6-1-7 2 2 3 5 2 7-2Z" fill="#047857" stroke="#34d399" />
          <path d="M12 19c2.5-1.5 5-0.8 6 1.5-1.8 2.2-4.2 1.5-6-1.5Z" fill="#065f46" stroke="#6ee7b7" />
          <circle cx="12" cy="3" r="1.5" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span
            className={`${titleSizes[size]} tracking-tight leading-none ${
              isLight ? 'text-white' : 'text-emerald-950'
            }`}
          >
            HIKMAT <span className="text-emerald-700 font-bold">TANI</span>
          </span>
        </div>
        {showSlogan && (
          <span
            className={`text-[11px] leading-tight font-medium mt-0.5 ${
              isLight ? 'text-emerald-200/80' : 'text-slate-500'
            }`}
          >
            Cerdas Bertani, Bijak Mengambil Keputusan
          </span>
        )}
      </div>
    </div>
  );
}
