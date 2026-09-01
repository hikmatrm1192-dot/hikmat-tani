/**
 * HIKMAT TANI - Mobile Bottom Navigation
 * 
 * Target Pengguna: Petani di lapangan (penggunaan 1 tangan di luar ruangan)
 * - Tap target minimal 48px
 * - Maksimal 5 menu utama: Beranda, Lahan, Kegiatan, Informasi, Saya
 * - Kontras tinggi & label jelas
 */

import { BookOpen, CalendarDays, Home, Layers, Map as MapIcon, User } from 'lucide-react';

export type MainNavTab = 'beranda' | 'peta' | 'lahan' | 'kegiatan' | 'informasi' | 'saya' | 'cuaca';

interface BottomNavProps {
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
}

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  const navItems: { id: MainNavTab; label: string; icon: typeof Home }[] = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'peta', label: 'Peta', icon: MapIcon },
    { id: 'lahan', label: 'Lahan', icon: Layers },
    { id: 'kegiatan', label: 'Kegiatan', icon: CalendarDays },
    { id: 'saya', label: 'Saya', icon: User },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] px-2 py-1 safe-area-pb"
      aria-label="Navigasi Utama Mobile"
    >
      <div className="grid grid-cols-5 items-center max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center min-h-[52px] py-1 px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-[#0F5132] font-black'
                  : 'text-slate-500 hover:text-slate-800 active:text-[#0F5132] font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`w-10 h-7 flex items-center justify-center rounded-full transition-all ${
                  isActive ? 'bg-[#0F5132]/10 text-[#0F5132] font-bold' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span className={`text-[11px] leading-tight mt-0.5 tracking-tight ${isActive ? 'font-black text-[#0F5132]' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
