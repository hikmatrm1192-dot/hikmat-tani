/**
 * HIKMAT TANI - Standar Resmi Kategori & Peta Kekeringan Modal
 * 
 * Filosofi:
 * "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."
 * 
 * Kategori Baku:
 * 1. TERANCAM (🟡)
 * 2. RINGAN (🟠)
 * 3. SEDANG (🔴)
 * 4. BERAT (🟣)
 * 5. PUSO (⚫)
 */

import { Info, ShieldAlert, Sparkles, X } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { DROUGHT_STANDARDS, DroughtCategory } from '../../types/index.ts';

interface DroughtLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DroughtLegendModal({ isOpen, onClose }: DroughtLegendModalProps) {
  const categories: DroughtCategory[] = ['TERANCAM', 'RINGAN', 'SEDANG', 'BERAT', 'PUSO'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Standar Kategori Risiko Kekeringan"
      subtitle="Klasifikasi baku pemantauan dampak iklim pada tanaman padi"
    >
      <div className="space-y-4 font-sans text-slate-800">
        {/* Catatan Penting */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Catatan Agroklimat:</strong> Status di bawah merupakan <em>Indikasi Risiko Kekeringan</em> yang dihitung dari sintesis curah hujan meteorologis, indeks citra satelit vegetasi (VCI), kelembapan tanah, dan umur HST tanaman padi.
          </div>
        </div>

        {/* 5 Kategori Baku */}
        <div className="space-y-2.5">
          {categories.map((catKey) => {
            const item = DROUGHT_STANDARDS[catKey];
            return (
              <div
                key={item.category}
                className="p-3 rounded-2xl border border-slate-200/90 bg-white space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs border ${item.badgeClass}`}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {item.officialSource}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-snug">
                  {item.definition}
                </p>
              </div>
            );
          })}
        </div>

        {/* 3 Pilar Analisis */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <span>3 Pilar Analisis Kekeringan HIKMAT TANI:</span>
          </div>
          <ol className="list-decimal pl-4 space-y-1 text-slate-600">
            <li><strong>Kekeringan Meteorologis:</strong> Jumlah hari tanpa hujan (HTH) dan akumulasi curah hujan 10-30 hari.</li>
            <li><strong>Kekeringan Vegetasi:</strong> Respons kanopi tanaman padi via indeks spektral citra satelit (VCI/NDRE).</li>
            <li><strong>Kekeringan Pertanian:</strong> Kebutuhan air riil berdasarkan fase rentan padi (fase bunting/berbunga 45-70 HST paling peka).</li>
          </ol>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
