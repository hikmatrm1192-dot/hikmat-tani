/**
 * HIKMAT TANI - Village Boundary Detail Modal (Alias to AdminBoundaryDetailModal)
 */

import { AdminBoundaryDetailModal } from './AdminBoundaryDetailModal.tsx';
import { VillageBoundaryFeature } from '../../types/villageBoundary.ts';

interface VillageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  village: VillageBoundaryFeature | null;
  onFocusVillage?: (village: VillageBoundaryFeature) => void;
}

export function VillageDetailModal({
  isOpen,
  onClose,
  village,
  onFocusVillage,
}: VillageDetailModalProps) {
  return (
    <AdminBoundaryDetailModal
      isOpen={isOpen}
      onClose={onClose}
      feature={village}
      onFocusFeature={onFocusVillage}
    />
  );
}
