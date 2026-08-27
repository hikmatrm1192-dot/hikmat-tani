/**
 * HIKMAT TANI - Brand Logo & Identity Component
 * 
 * Tagline Resmi: "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."
 * Aset Resmi:
 * - Logo Horizontal Lengkap: /logo-hikmat-tani-full.png
 * - Logo Emblem Utama: /logo-hikmat-tani-1024.png / /icon-192.png
 */

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSlogan?: boolean;
  className?: string;
  variant?: 'light' | 'dark' | 'full';
  useFullLogo?: boolean;
}

export function BrandLogo({
  size = 'md',
  showSlogan = false,
  className = '',
  variant = 'dark',
  useFullLogo = false,
}: BrandLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const fullLogoHeights = {
    sm: 'h-8 max-w-[160px]',
    md: 'h-10 max-w-[200px]',
    lg: 'h-14 max-w-[260px]',
    xl: 'h-20 max-w-[340px]',
  };

  const titleSizes = {
    sm: 'text-base font-bold',
    md: 'text-lg font-extrabold',
    lg: 'text-2xl font-black',
    xl: 'text-3xl font-black',
  };

  const isLight = variant === 'light';

  // Jika diminta logo horizontal lengkap dari aset resmi
  if (useFullLogo) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <img
          src="/logo-hikmat-tani-full.png"
          alt="HIKMAT TANI — CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."
          className={`${fullLogoHeights[size]} w-auto object-contain`}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.includes('/logo-hikmat-tani-1024.png')) {
              target.src = '/logo-hikmat-tani-1024.png';
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {/* Official HIKMAT TANI Emblem Icon */}
      <div
        className={`${iconSizes[size]} shrink-0 flex items-center justify-center rounded-xl overflow-hidden shadow-xs bg-emerald-950/20 border border-emerald-600/30 p-0.5`}
      >
        <img
          src="/logo-hikmat-tani-1024.png"
          alt="Logo Utama HIKMAT TANI"
          className="w-full h-full object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.includes('/icon-192.png')) {
              target.src = '/icon-192.png';
            }
          }}
        />
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`${titleSizes[size]} tracking-tight leading-none ${
              isLight ? 'text-white' : 'text-emerald-950'
            }`}
          >
            HIKMAT <span className="text-emerald-500 font-bold">TANI</span>
          </span>
        </div>
        {showSlogan && (
          <span
            className={`text-[11px] sm:text-xs leading-tight font-semibold mt-1 tracking-wide truncate ${
              isLight ? 'text-emerald-200/90' : 'text-slate-600'
            }`}
          >
            CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.
          </span>
        )}
      </div>
    </div>
  );
}

