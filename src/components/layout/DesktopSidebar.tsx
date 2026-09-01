/**
 * HIKMAT TANI - Desktop & Tablet Navigation Sidebar
 * 
 * Sederhana, elegan, kontras tinggi, brand identity konsisten.
 */

import { BookOpen, CalendarDays, CloudSun, Home, Layers, Map as MapIcon, User } from 'lucide-react';
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
    { id: 'peta', label: 'Peta Pertanian', icon: MapIcon, description: 'Satelit 2D, GPS & petak' },
    { id: 'cuaca', label: 'Prakiraan Cuaca', icon: CloudSun, description: 'Cuaca 10 hari & saran tani' },
    { id: 'lahan', label: 'Lahan Saya', icon: Layers, description: 'Petak & musim tanam' },
    { id: 'kegiatan', label: 'Kegiatan', icon: CalendarDays, description: 'Catatan & linimasa' },
    { id: 'informasi', label: 'Informasi', icon: BookOpen, description: 'Pustaka & rujukan ilmiah' },
    { id: 'saya', label: 'Saya', icon: User, description: 'Profil, donasi & bantuan' },
  ];

  return (
    <aside
      className="hidden md:flex flex-col w-64 lg:w-72 bg-[#072417] text-slate-100 h-screen sticky top-0 border-r border-[#0F5132]/40 p-5 select-none shrink-0"
      aria-label="Navigasi Utama Desktop"
    >
      {/* Brand Header */}
      <div className="pb-6 border-b border-[#0F5132]/40">
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
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left transition-all min-h-[48px] ${
                isActive
                  ? 'bg-[#0F5132] text-white font-bold shadow-md border border-[#2E7D4F]/50'
                  : 'text-emerald-100/70 hover:bg-[#0B3D26] hover:text-white font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                  isActive ? 'bg-[#D4AF37] text-[#072417] font-bold shadow-xs' : 'bg-[#0B3D26] text-emerald-300'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm leading-none">{item.label}</span>
                <span className="text-[11px] text-emerald-200/60 mt-1">{item.description}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer / Offline Status */}
      <div className="pt-4 border-t border-[#0F5132]/40 space-y-3">
        <div className="flex justify-center">
          <ConnectionStatus />
        </div>
        <p className="text-[10px] text-center text-emerald-300/60 font-medium truncate px-2">
          {brandConfig.appName || 'HIKMAT TANI'} • Offline-First
        </p>
      </div>
    </aside>
  );
}
