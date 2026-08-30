/**
 * HIKMAT TANI - App Layout Shell
 * 
 * Shell responsif:
 * - Mobile: Top header sederhana + Main content + Bottom Navigation
 * - Desktop/Tablet: Sidebar kiri + Main content
 */

import { ReactNode } from 'react';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { ConnectionStatus } from '../common/ConnectionStatus.tsx';
import { BottomNav, MainNavTab } from './BottomNav.tsx';
import { DesktopSidebar } from './DesktopSidebar.tsx';

interface AppLayoutProps {
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
  children: ReactNode;
}

export function AppLayout({ activeTab, onSelectTab, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F7F6F0] text-slate-800 flex flex-col md:flex-row antialiased overflow-x-hidden">
      {/* Desktop & Tablet Sidebar */}
      <DesktopSidebar activeTab={activeTab} onSelectTab={onSelectTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-8">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shadow-xs min-h-[58px]">
          <div className="min-w-0 flex-1 mr-1">
            <BrandLogo size="header" showSlogan={true} />
          </div>
          <div className="shrink-0">
            <ConnectionStatus />
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onSelectTab={onSelectTab} />
    </div>
  );
}
