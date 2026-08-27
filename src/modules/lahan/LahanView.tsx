/**
 * HIKMAT TANI - Lahan View (Kelola Petak Sawah)
 * 
 * Prinsip:
 * - Menampilkan daftar petak lahan milik petani.
 * - Menampilkan status musim tanam aktif, HST, dan fase untuk masing-masing lahan.
 * - Memberi kemudahan menambah lahan baru dan memulai musim tanam.
 */

import { useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { PageHeader } from '../../components/common/PageHeader.tsx';
import { CropSeason, Land, RiceVariety } from '../../types/index.ts';
import { LandCard } from './LandCard.tsx';
import { SeasonDetailModal } from './SeasonDetailModal.tsx';

interface LahanViewProps {
  lands: Land[];
  activeSeasons: CropSeason[];
  varieties: RiceVariety[];
  onOpenAddLand: () => void;
  onOpenStartSeason: (land: Land) => void;
  onRefreshData?: () => Promise<void>;
}

export function LahanView({
  lands,
  activeSeasons,
  varieties,
  onOpenAddLand,
  onOpenStartSeason,
  onRefreshData,
}: LahanViewProps) {
  const [selectedModalData, setSelectedModalData] = useState<{
    land: Land;
    season: CropSeason;
  } | null>(null);

  const handleViewSeason = (land: Land, season: CropSeason) => {
    setSelectedModalData({ land, season });
  };

  const activeSeasonCount = activeSeasons.filter((s) => s.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Lahan Saya"
        subtitle={`Total ${lands.length} petak sawah terdaftar • ${activeSeasonCount} musim aktif`}
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

      {/* Konten Daftar Lahan */}
      {lands.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-8 h-8 text-emerald-700" />}
          title="Belum Ada Petak Sawah"
          description="Daftarkan petak sawah Anda (nama lahan, luas, sumber air) untuk mulai mencatat musim tanam dan kalender kegiatan."
          actionText="+ Tambah Petak Sawah Pertama"
          onAction={onOpenAddLand}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lands.map((land) => {
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
                onViewSeason={handleViewSeason}
                onStartSeason={onOpenStartSeason}
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
    </div>
  );
}
