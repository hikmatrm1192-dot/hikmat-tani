/**
 * HIKMAT TANI - Brand Logo & Identity Component
 * 
 * Slogan Resmi: "Bijak Bertani, Cerdas Bertani"
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
      {/* Official HIKMAT TANI Brand Icon */}
      <div
        className={`${iconSizes[size]} rounded-xl overflow-hidden shadow-xs border border-emerald-600/30 shrink-0 flex items-center justify-center bg-emerald-900`}
      >
        <img
          src="/icon.svg"
          alt="Logo HIKMAT TANI"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to embedded SVG if image fails
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
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
            Bijak Bertani, Cerdas Bertani
          </span>
        )}
      </div>
    </div>
  );
}
