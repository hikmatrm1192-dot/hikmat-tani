/**
 * HIKMAT TANI - Modal Pemilihan Jenis Pupuk
 * Dirancang proporsional dan responsif untuk mobile Android & Desktop.
 * Menggantikan native select dengan hierarki visual yang rapi, kompak, dan jelas.
 */

import React, { useState, useMemo } from 'react';
import { Search, X, Check, Sparkles, Plus, Leaf, FlaskConical, Tag } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Fertilizer } from '../../types/fertilizer';

interface FertilizerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fertilizers: Fertilizer[];
  selectedFertId: string;
  onSelectFertilizer: (fertId: string) => void;
}

type FilterCategory = 'ALL' | 'SUBSIDIZED' | 'NON_SUBSIDIZED' | 'ORGANIC' | 'BIOLOGICAL';

export function FertilizerPickerModal({
  isOpen,
  onClose,
  fertilizers,
  selectedFertId,
  onSelectFertilizer,
}: FertilizerPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');

  // Filter dan pencarian pupuk
  const filteredFertilizers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return fertilizers.filter((f) => {
      // Filter kategori tab
      if (activeFilter === 'SUBSIDIZED' && !f.isSubsidized) return false;
      if (activeFilter === 'NON_SUBSIDIZED' && (f.isSubsidized || f.type === 'ORGANIC' || f.type === 'BIOLOGICAL' || (f.type as string) === 'BIOFERTILIZER')) return false;
      if (activeFilter === 'ORGANIC' && f.type !== 'ORGANIC') return false;
      if (activeFilter === 'BIOLOGICAL' && f.type !== 'BIOLOGICAL' && (f.type as string) !== 'BIOFERTILIZER') return false;

      // Filter query pencarian
      if (!q) return true;

      const nameMatch = f.name?.toLowerCase().includes(q);
      const formulaMatch = f.formula?.toLowerCase().includes(q);
      const brandMatch = f.brand?.toLowerCase().includes(q);
      const categoryMatch = f.category?.toLowerCase().includes(q);
      const manufacturerMatch = f.manufacturer?.toLowerCase().includes(q);
      const aliasMatch = f.aliases?.some((a) => a.toLowerCase().includes(q));

      return nameMatch || formulaMatch || brandMatch || categoryMatch || manufacturerMatch || aliasMatch;
    });
  }, [fertilizers, searchQuery, activeFilter]);

  // Kelompokkan pupuk jika tidak sedang mencari
  const isSearching = searchQuery.trim().length > 0 || activeFilter !== 'ALL';

  const groupedFertilizers = useMemo(() => {
    if (isSearching) return null;

    const subsidized = fertilizers.filter((f) => f.isSubsidized);
    const nonSubsidizedInorganic = fertilizers.filter(
      (f) =>
        !f.isSubsidized &&
        (f.type === 'INORGANIC_SINGLE' || f.type === 'INORGANIC_COMPOUND')
    );
    const organic = fertilizers.filter(
      (f) => !f.isSubsidized && f.type === 'ORGANIC'
    );
    const biological = fertilizers.filter(
      (f) =>
        !f.isSubsidized &&
        (f.type === 'BIOLOGICAL' || (f.type as string) === 'BIOFERTILIZER')
    );

    return {
      subsidized,
      nonSubsidizedInorganic,
      organic,
      biological,
    };
  }, [fertilizers, isSearching]);

  const handleSelect = (id: string) => {
    onSelectFertilizer(id);
    onClose();
  };

  // Helper render kandungan hara ringkas
  const renderNutrientPill = (fert: Fertilizer) => {
    const comp = fert.nutrientComposition;
    if (!comp) return null;

    const parts: string[] = [];
    if (comp.N) parts.push(`N: ${comp.N}%`);
    if (comp.P2O5) parts.push(`P₂O₅: ${comp.P2O5}%`);
    if (comp.K2O) parts.push(`K₂O: ${comp.K2O}%`);
    if (comp.S) parts.push(`S: ${comp.S}%`);
    if (comp.Ca) parts.push(`Ca: ${comp.Ca}%`);
    if (comp.Mg) parts.push(`Mg: ${comp.Mg}%`);

    if (parts.length === 0) return null;

    return (
      <span className="text-[10px] sm:text-[11px] font-medium text-emerald-800 leading-none">
        {parts.join(' • ')}
      </span>
    );
  };

  const renderFertilizerItem = (fert: Fertilizer) => {
    const isSelected = selectedFertId === fert.id;

    return (
      <button
        key={fert.id}
        type="button"
        onClick={() => handleSelect(fert.id)}
        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 active:scale-[0.99] ${
          isSelected
            ? 'bg-emerald-50/90 border-emerald-500 ring-1 ring-emerald-500 shadow-2xs'
            : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/80'
        }`}
      >
        {/* Radio Button Indikator Proporsional (Fixed 14px) */}
        <div
          className={`w-3.5 h-3.5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
            isSelected
              ? 'border-emerald-600 bg-emerald-600'
              : 'border-slate-300 bg-white'
          }`}
          aria-hidden="true"
        >
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>

        {/* Konten & Hierarki Tipografi Proporsional Mobile */}
        <div className="flex-1 min-w-0">
          {/* Baris 1: Nama Pupuk + Badge Subsidi / Kategori */}
          <div className="flex items-start justify-between gap-1.5">
            <span
              className={`text-xs sm:text-[13px] font-bold leading-snug break-words ${
                isSelected ? 'text-emerald-950' : 'text-slate-900'
              }`}
            >
              {fert.name}
            </span>

            {fert.isSubsidized && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 leading-none">
                Subsidi
              </span>
            )}
          </div>

          {/* Baris 2: Formula & Merek/Produsen */}
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[11px] text-slate-600 leading-tight">
            {fert.formula && (
              <span className="inline-block font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-slate-200/70">
                {fert.formula}
              </span>
            )}

            {fert.brand && fert.brand !== fert.name && (
              <span className="text-[10px] sm:text-[11px] text-slate-500">
                • {fert.brand}
              </span>
            )}

            {fert.category && (
              <span className="text-[10px] sm:text-[11px] text-slate-500">
                • {fert.category}
              </span>
            )}
          </div>

          {/* Baris 3: Ringkasan Hara (Jika ada) */}
          <div className="mt-0.5 flex items-center gap-1.5">
            {renderNutrientPill(fert)}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pilih Jenis Pupuk"
      subtitle="Pilih pupuk anorganik, organik, hayati, atau isi manual"
      maxWidth="md"
    >
      <div className="space-y-3">
        {/* Search Bar Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pupuk (e.g. Urea, NPK, Petroganik, 16-16-16)..."
            className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[38px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs / Chips Kategori */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
              activeFilter === 'ALL'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua ({fertilizers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('SUBSIDIZED')}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
              activeFilter === 'SUBSIDIZED'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🌱 Subsidi
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('NON_SUBSIDIZED')}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
              activeFilter === 'NON_SUBSIDIZED'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            💼 Non-Subsidi
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('ORGANIC')}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
              activeFilter === 'ORGANIC'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🍂 Organik
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('BIOLOGICAL')}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
              activeFilter === 'BIOLOGICAL'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🔬 Hayati
          </button>
        </div>

        {/* List Pilihan Pupuk */}
        <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
          {/* Tampilan Terkelompok (Default ketika belum search) */}
          {groupedFertilizers ? (
            <div className="space-y-3">
              {/* 1. Pupuk Bersubsidi */}
              {groupedFertilizers.subsidized.length > 0 && (
                <div className="space-y-1">
                  <div className="px-0.5 flex items-center justify-between text-[11px] font-bold text-emerald-950 uppercase tracking-wide">
                    <span>🌱 Pupuk Bersubsidi Pemerintah</span>
                    <span className="text-[10px] text-emerald-700 font-medium lowercase">
                      e-Alokasi / RDKK
                    </span>
                  </div>
                  <div className="space-y-1">
                    {groupedFertilizers.subsidized.map(renderFertilizerItem)}
                  </div>
                </div>
              )}

              {/* 2. Pupuk Non-Subsidi / Komersial */}
              {groupedFertilizers.nonSubsidizedInorganic.length > 0 && (
                <div className="space-y-1">
                  <div className="px-0.5 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    💼 Pupuk Non-Subsidi / Komersial
                  </div>
                  <div className="space-y-1">
                    {groupedFertilizers.nonSubsidizedInorganic.map(renderFertilizerItem)}
                  </div>
                </div>
              )}

              {/* 3. Pupuk Organik & Lokal */}
              {groupedFertilizers.organic.length > 0 && (
                <div className="space-y-1">
                  <div className="px-0.5 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    🍂 Pupuk Organik & Lokal
                  </div>
                  <div className="space-y-1">
                    {groupedFertilizers.organic.map(renderFertilizerItem)}
                  </div>
                </div>
              )}

              {/* 4. Pupuk Hayati & Biofertilizer */}
              {groupedFertilizers.biological.length > 0 && (
                <div className="space-y-1">
                  <div className="px-0.5 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    🔬 Pupuk Hayati & Biofertilizer
                  </div>
                  <div className="space-y-1">
                    {groupedFertilizers.biological.map(renderFertilizerItem)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tampilan Pencarian / Filter Tertentu */
            <div className="space-y-1">
              {filteredFertilizers.length > 0 ? (
                filteredFertilizers.map(renderFertilizerItem)
              ) : (
                <div className="py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Tidak ditemukan pupuk dengan kata kunci "{searchQuery}".
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Anda dapat menggunakan opsi isi manual di bawah ini.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Opsi Tambahan: Pupuk Manual / Custom */}
          <div className="pt-1.5 border-t border-slate-200">
            <button
              type="button"
              onClick={() => handleSelect('__CUSTOM__')}
              className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 active:scale-[0.99] ${
                selectedFertId === '__CUSTOM__'
                  ? 'bg-emerald-50/90 border-emerald-500 ring-1 ring-emerald-500 shadow-2xs'
                  : 'bg-slate-50/70 border-dashed border-slate-300 hover:border-emerald-300 hover:bg-slate-100/80'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                  selectedFertId === '__CUSTOM__'
                    ? 'border-emerald-600 bg-emerald-600'
                    : 'border-slate-300 bg-white'
                }`}
                aria-hidden="true"
              >
                {selectedFertId === '__CUSTOM__' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                    + Pupuk Lainnya / Isi Manual
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Gunakan opsi ini jika jenis pupuk atau racikan Anda tidak ada di master data.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{fertilizers.length} jenis pupuk terdaftar</span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
