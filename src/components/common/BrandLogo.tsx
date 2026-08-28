/**
 * HIKMAT TANI - Brand Logo & Identity Component (Langkah 15 & 16)
 * 
 * Mendukung konfigurasi identitas visual dinamis dari Portal Pengelola & offline cache:
 * - Logo Utama (Emblem/Primary)
 * - Logo Horizontal (Full)
 * - Ikon Aplikasi (App Icon)
 * - Nama Aplikasi Dinamis
 * - Tagline Resmi Dinamis (Default: "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.")
 */

import React from 'react';
import { useBrandConfig } from '../../services/publicConfigService.ts';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSlogan?: boolean;
  className?: string;
  variant?: 'light' | 'dark' | 'full';
  useFullLogo?: boolean;
  customLogoUrl?: string;
  customAppName?: string;
  customSlogan?: string;
}

export function BrandLogo({
  size = 'md',
  showSlogan = false,
  className = '',
  variant = 'dark',
  useFullLogo = false,
  customLogoUrl,
  customAppName,
  customSlogan,
}: BrandLogoProps) {
  const brandConfig = useBrandConfig();

  const appName = customAppName || brandConfig.appName || 'HIKMAT TANI';
  const slogan = customSlogan || brandConfig.slogan || 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.';
  const primaryLogo = customLogoUrl || brandConfig.logoPrimary || brandConfig.logoUrl || '/icon-512.png';
  const horizontalLogo = brandConfig.logoHorizontal || '/logo-hikmat-tani-full.png';

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

  // 1. Render Logo Horizontal Lengkap jika diminta
  if (useFullLogo) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <img
          src={horizontalLogo}
          alt={`${appName} — ${slogan}`}
          className={`${fullLogoHeights[size]} w-auto object-contain`}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.includes('/logo-hikmat-tani-full.png') && !target.src.includes('/icon-512.png')) {
              target.src = '/logo-hikmat-tani-full.png';
            }
          }}
        />
      </div>
    );
  }

  // Pisahkan kata pertama dan sisanya untuk styling aksen visual
  const nameParts = appName.trim().split(/\s+/);
  const firstWord = nameParts[0] || 'HIKMAT';
  const restWords = nameParts.slice(1).join(' ') || (nameParts.length === 1 ? '' : 'TANI');

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {/* Official Emblem / Icon */}
      <div
        className={`${iconSizes[size]} shrink-0 flex items-center justify-center rounded-xl overflow-hidden shadow-xs bg-[#0B3D26]/20 border border-[#2E7D4F]/40 p-0.5`}
      >
        <img
          src={primaryLogo}
          alt={`Logo ${appName}`}
          className="w-full h-full object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.includes('/icon-512.png') && !target.src.includes('/icon-192.png')) {
              target.src = '/icon-512.png';
            }
          }}
        />
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`${titleSizes[size]} tracking-tight leading-none`}>
            <span className={isLight ? 'text-[#D4AF37] font-black' : 'text-[#B89327] font-black'}>
              {firstWord}
            </span>{' '}
            {restWords && (
              <span className={isLight ? 'text-white font-black' : 'text-[#0F5132] font-black'}>
                {restWords}
              </span>
            )}
          </span>
        </div>
        {showSlogan && (
          <span
            className={`text-[11px] sm:text-xs leading-tight font-semibold mt-1 tracking-wide truncate ${
              isLight ? 'text-emerald-100/80' : 'text-[#2E7D4F]'
            }`}
          >
            {slogan}
          </span>
        )}
      </div>
    </div>
  );
}


