/**
 * HIKMAT TANI - Lahan View (Kelola Petak Sawah)
 * 
 * Prinsip:
 * - Menampilkan daftar petak lahan milik petani.
 * - Menampilkan status musim tanam aktif, HST, dan fase untuk masing-masing lahan.
 * - Memberi kemudahan menambah lahan baru dan memulai musim tanam.
 */

import { useState } from 'react';
import { Archive, Layers, Plus } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { PageHeader } from '../../components/common/PageHeader.tsx';
import { CropSeason, Land, RiceVariety } from '../../types/index.ts';
import { LandCard } from './LandCard.tsx';
import { ManageLandModal } from './ManageLandModal.tsx';
import { SeasonDetailModal } from './SeasonDetailModal.tsx';

interface LahanViewProps {
  lands: Land[];
  activeSeasons: CropSeason[];
  varieties: RiceVariety[];
  selectedLandId?: string;
  onSelectLandId?: (landId: string) => void;
  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya') => void;
  onOpenAddLand: () => void;
  onOpenStartSeason: (land: Land) => void;
  onRefreshData?: () => Promise<void>;
}

export function LahanView({
  lands,
  activeSeasons,
  varieties,
  selectedLandId,
  onSelectLandId,
  onNavigateToTab,
  onOpenAddLand,
  onOpenStartSeason,
  onRefreshData,
}: LahanViewProps) {
  const [filterTab, setFilterTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [selectedModalData, setSelectedModalData] = useState<{
    land: Land;
    season: CropSeason;
  } | null>(null);
  const [managingLand, setManagingLand] = useState<Land | null>(null);

  const handleViewSeason = (land: Land, season: CropSeason) => {
    setSelectedModalData({ land, season });
  };

  const activeLands = lands.filter((l) => l.status !== 'ARCHIVED');
  const archivedLands = lands.filter((l) => l.status === 'ARCHIVED');
  const displayedLands = filterTab === 'ACTIVE' ? activeLands : archivedLands;

  const activeSeasonCount = activeSeasons.filter((s) => s.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Lahan Saya"
        subtitle={`Total ${activeLands.length} petak sawah aktif • ${activeSeasonCount} musim aktif`}
        action={
          <button
            type="button"
            onClick={onOpenAddLand}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Lahan</span>
          </button>
        }
      />

      {/* Tab Filter Status Lahan (Aktif vs Arsip) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setFilterTab('ACTIVE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] flex items-center gap-2 ${
            filterTab === 'ACTIVE'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Lahan Aktif ({activeLands.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('ARCHIVED')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] flex items-center gap-2 ${
            filterTab === 'ARCHIVED'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Lahan Diarsipkan ({archivedLands.length})</span>
        </button>
      </div>

      {/* Konten Daftar Lahan */}
      {displayedLands.length === 0 ? (
        filterTab === 'ACTIVE' ? (
          <EmptyState
            icon={<Layers className="w-8 h-8 text-emerald-700" />}
            title="Belum Ada Petak Sawah Aktif"
            description="Daftarkan petak sawah Anda (nama lahan, luas, sumber air) untuk mulai mencatat musim tanam dan kalender kegiatan."
            actionText="+ Tambah Petak Sawah Pertama"
            onAction={onOpenAddLand}
          />
        ) : (
          <EmptyState
            icon={<Archive className="w-8 h-8 text-slate-400" />}
            title="Tidak Ada Lahan Diarsipkan"
            description="Lahan yang tidak aktif lagi dapat Anda arsipkan melalui tombol kelola lahan agar riwayatnya tetap tersimpan rapi."
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedLands.map((land) => {
            const season = activeSeasons.find(
              (s) => s.landId === land.id && s.status === 'ACTIVE'
            );
            const matchedVariety = varieties.find(
              (v) =>
                v.name.toLowerCase().trim() === (season?.varietyName || '').toLowerCase().trim()
            );
            const duration = matchedVariety?.growthDurationDays || 120;

            return (
              <LandCard
                key={land.id}
                land={land}
                activeSeason={season}
                varietyDurationDays={duration}
                isSelected={land.id === selectedLandId}
                onSelectLand={onSelectLandId}
                onViewSeason={handleViewSeason}
                onStartSeason={onOpenStartSeason}
                onManageLand={(targetLand) => setManagingLand(targetLand)}
                onNavigateToTab={onNavigateToTab}
              />
            );
          })}
        </div>
      )}

      {/* Modal Rincian Musim Tanam */}
      {selectedModalData && (
        <SeasonDetailModal
          isOpen={selectedModalData !== null}
          onClose={() => setSelectedModalData(null)}
          land={selectedModalData.land}
          season={selectedModalData.season}
          varietyDurationDays={
            varieties.find(
              (v) =>
                v.name.toLowerCase().trim() ===
                (selectedModalData.season.varietyName || '').toLowerCase().trim()
            )?.growthDurationDays || 120
          }
          onSeasonUpdated={onRefreshData}
        />
      )}

      {/* Modal Kelola Lahan (Edit / Arsip / Hapus Permanen) */}
      {managingLand && (
        <ManageLandModal
          isOpen={managingLand !== null}
          onClose={() => setManagingLand(null)}
          land={managingLand}
          onSuccess={async () => {
            if (onRefreshData) {
              await onRefreshData();
            }
          }}
        />
      )}
    </div>
  );
}
