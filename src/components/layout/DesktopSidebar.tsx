/**
 * HIKMAT TANI - Desktop & Tablet Navigation Sidebar
 * 
 * Sederhana, elegan, kontras tinggi, brand identity konsisten.
 */

import { BookOpen, CalendarDays, Home, Layers, User } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { ConnectionStatus } from '../common/ConnectionStatus.tsx';
import { useBrandConfig } from '../../services/publicConfigService.ts';
import { MainNavTab } from './BottomNav.tsx';

interface DesktopSidebarProps {
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
}

export function DesktopSidebar({ activeTab, onSelectTab }: DesktopSidebarProps) {
  const brandConfig = useBrandConfig();
  const navItems: { id: MainNavTab; label: string; icon: typeof Home; description: string }[] = [
    { id: 'beranda', label: 'Beranda', icon: Home, description: 'Kondisi lapang & saran' },
    { id: 'lahan', label: 'Lahan Saya', icon: Layers, description: 'Petak & musim tanam' },
    { id: 'kegiatan', label: 'Kegiatan', icon: CalendarDays, description: 'Catatan & linimasa' },
    { id: 'informasi', label: 'Informasi', icon: BookOpen, description: 'Pustaka & rujukan ilmiah' },
    { id: 'saya', label: 'Saya', icon: User, description: 'Profil, donasi & bantuan' },
  ];

  return (
    <aside
      className="hidden md:flex flex-col w-64 lg:w-72 bg-emerald-950 text-slate-100 h-screen sticky top-0 border-r border-emerald-900/60 p-5 select-none shrink-0"
      aria-label="Navigasi Utama Desktop"
    >
      {/* Brand Header */}
      <div className="pb-6 border-b border-emerald-900/60">
        <BrandLogo size="md" showSlogan variant="light" />
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all min-h-[48px] ${
                isActive
                  ? 'bg-emerald-800/90 text-white font-bold shadow-xs border border-emerald-700/50'
                  : 'text-emerald-200/80 hover:bg-emerald-900/50 hover:text-white font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-amber-400 text-emerald-950 font-bold' : 'bg-emerald-900/80 text-emerald-300'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm leading-none">{item.label}</span>
                <span className="text-[11px] text-emerald-300/60 mt-1">{item.description}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer / Offline Status */}
      <div className="pt-4 border-t border-emerald-900/60 space-y-3">
        <div className="flex justify-center">
          <ConnectionStatus />
        </div>
        <p className="text-[10px] text-center text-emerald-400/60 font-medium truncate px-2">
          {brandConfig.appName || 'HIKMAT TANI'} • Offline-First
        </p>
      </div>
    </aside>
  );
}
