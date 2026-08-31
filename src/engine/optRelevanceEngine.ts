/**
 * HIKMAT TANI - Agronomic OPT Relevance & Reference Matching Engine
 * 
 * Prinsip:
 * 1. Tidak membuat diagnosis palsu atau mengubah "belum tahu" menjadi diagnosis pasti.
 * 2. Menemukan rujukan agronomi terdaftar yang paling relevan berdasarkan kombinasi:
 *    - nama sementara / catatan bebas
 *    - deskripsi gejala lapang (symptoms)
 *    - bagian tanaman yang terserang (attackLocation)
 *    - petunjuk visual dari foto tanaman (visual tokens & visual clues)
 *    - sinonim/alias lokal
 *    - literasi gejala & pemicu di pustaka HIKMAT TANI
 * 3. Menghilangkan noise/stopwords non-agronomi (e.g., 'tanaman', 'terlihat', 'petak', 'sawah', 'dan', 'di').
 * 4. Memberi bobot tinggi pada kata/frasa agronomi spesifik (e.g., 'daun menguning', 'rumpun kerdil', 'bercak', 'sundep').
 * 5. Menyajikan PHT / Penanganan Non-Kimia terlebih dahulu (7 Tahapan / 4 Pilar PHT).
 * 6. Menyajikan Bahan Aktif Kimia HANYA sebagai opsi rujukan lanjutan dari data resmi terdaftar.
 * 7. Deterministic, offline-first, tanpa ketergantungan jaringan eksternal.
 */

import { AttackLocation, Opt, OptCategory } from '../types/index.ts';

export interface PhtStepItem {
  stepNumber: number;
  categoryTitle: string;
  actionTitle: string;
  description: string;
}

export interface ChemicalControlOption {
  hasChemicalData: boolean;
  activeIngredients: string[];
  resistanceNotes?: string;
  cautionaryNotice: string;
}

export interface OptRelevanceMatch {
  opt: Opt;
  score: number;
  matchedKeywords: string[];
  matchedVisualClues: string[];
  matchedLocations: string[];
  matchedSymptoms: string[];
  isExactMatch: boolean;
  relevanceLabel: string;
  similarityReason: string;
  disclaimer: string;
  phtSteps: PhtStepItem[];
  chemicalOptions: ChemicalControlOption;
}

export interface OptSearchOptions {
  attackLocations?: (AttackLocation | string)[];
  category?: OptCategory | 'ALL' | string;
  minScoreThreshold?: number;
  visualTokens?: string[];
  visualClues?: string[];
  growthStage?: string;
}

// Stopwords umum bahasa Indonesia dan kata pengamatan non-spesifik
const AGRONOMY_STOPWORDS = new Set([
  'dan', 'atau', 'di', 'ke', 'dari', 'pada', 'yang', 'ini', 'itu', 'dengan',
  'untuk', 'oleh', 'karena', 'bisa', 'dapat', 'sudah', 'telah', 'belum', 'akan',
  'lagi', 'saat', 'ketika', 'secara', 'ada', 'terdapat', 'adanya', 'terlihat',
  'tampak', 'tampaklah', 'melihat', 'melihatnya', 'dilihat', 'petak', 'sawah',
  'tanaman', 'padi', 'bagian', 'kondisi', 'area', 'blok', 'banyak', 'sedikit',
  'agak', 'sangat', 'cukup', 'gejala', 'tanda', 'ciri', 'masalah', 'hama',
  'penyakit', 'terkena', 'menyerang', 'serangan', 'rusak', 'kerusakan', 'warna',
  'seperti', 'mirip', 'menjadi', 'terjadi', 'kondisinya', 'lapangan', 'saja',
]);

// Frasa agronomi bernilai tinggi (N-grams)
const AGRONOMIC_KEY_PHRASES = [
  'daun menguning',
  'daun kuning',
  'kuning oranye',
  'kuning jingga',
  'daun oranye',
  'rumpun kerdil',
  'tanaman kerdil',
  'kerdil kuning',
  'kerdil rumput',
  'kerdil oranye',
  'kerdil hampa',
  'anakan sedikit',
  'anakan berkurang',
  'daun terlipat',
  'daun melipat',
  'daun menggulung',
  'daun tergulung',
  'penggulung daun',
  'pelipat daun',
  'pucuk mati',
  'mati pucuk',
  'pucuk kering',
  'mudah dicabut',
  'sundep',
  'beluk',
  'malai hampa',
  'bulir hampa',
  'malai putih',
  'bercak belah ketupat',
  'belah ketupat',
  'bercak ketupat',
  'patah leher',
  'blas leher',
  'blas daun',
  'bercak coklat',
  'bercak oval',
  'bercak ular',
  'hawar daun',
  'hawar pelepah',
  'busuk pelepah',
  'busuk batang',
  'rebah batang',
  'batang terpotong',
  'potong miring',
  'liang sarang',
  'pematang sawah',
  'bulir berbintik',
  'beras bernoda',
  'bau sangit',
  'bau busuk',
  'telur merah muda',
  'bibit mengapung',
  'hopperburn',
  'seperti terbakar',
  'ulat grayak',
  'ulat tentara',
  'daun rompeng',
  'orong orong',
  'anjing tanah',
  'akar terpotong',
  'perakaran terpotong',
  'lalat bibit',
  'kepinding tanah',
  'kepik hitam',
  'burung pipit',
  'burung emprit',
  'burung bondol',
  'keong mas',
  'siput murbai',
];

// Mapping morfologi/stem kata dasar agronomi Indonesia
const STEM_MAP: Record<string, string> = {
  menguning: 'kuning',
  kekuningan: 'kuning',
  kuningan: 'kuning',
  kerdil: 'kerdil',
  kekerdilan: 'kerdil',
  mengkerut: 'kerdil',
  kerdilnya: 'kerdil',
  membusuk: 'busuk',
  pembusukan: 'busuk',
  busukan: 'busuk',
  melipat: 'lipat',
  terlipat: 'lipat',
  lipatan: 'lipat',
  menggulung: 'gulung',
  tergulung: 'gulung',
  gulungan: 'gulung',
  terpotong: 'potong',
  memotong: 'potong',
  pemotongan: 'potong',
  mengering: 'kering',
  kekeringan: 'kering',
  keringan: 'kering',
  terbakar: 'bakar',
  membakar: 'bakar',
  pembakaran: 'bakar',
  berbintik: 'bintik',
  bintik: 'bintik',
  bercak: 'bercak',
  rebah: 'rebah',
  merebah: 'rebah',
  kerebahan: 'rebah',
  hampa: 'hampa',
  kehampaan: 'hampa',
  rontok: 'rontok',
  merontok: 'rontok',
  berlubang: 'lubang',
  melubangi: 'lubang',
  lubang: 'lubang',
  bolong: 'lubang',
  mengapung: 'apung',
  terapung: 'apung',
  merah: 'merah',
  kemerahan: 'merah',
  putih: 'putih',
  keputihan: 'putih',
  hitam: 'hitam',
  kehitaman: 'hitam',
  layu: 'layu',
  melayu: 'layu',
  rompeng: 'rompeng',
  robek: 'robek',
  keriting: 'keriting',
  pelepah: 'pelepah',
  malai: 'malai',
  bulir: 'bulir',
  batang: 'batang',
  daun: 'daun',
  akar: 'akar',
  pucuk: 'pucuk',
  ulat: 'ulat',
  wereng: 'wereng',
  tikus: 'tikus',
  keong: 'keong',
  kepik: 'kepik',
  burung: 'burung',
};

/**
 * Normalisasi dan pembersihan teks
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ekstraksi token kata dan frasa agronomi yang bermakna
 */
export function extractAgronomicTokens(input: string): {
  phrases: string[];
  words: string[];
  stems: string[];
} {
  const normalized = normalizeText(input);
  if (!normalized) {
    return { phrases: [], words: [], stems: [] };
  }

  // 1. Ekstraksi frasa kunci yang cocok
  const matchedPhrases: string[] = [];
  for (const phrase of AGRONOMIC_KEY_PHRASES) {
    if (normalized.includes(phrase)) {
      matchedPhrases.push(phrase);
    }
  }

  // 2. Ekstraksi kata-kata non-stopword
  const rawWords = normalized.split(/\s+/).filter(Boolean);
  const meaningfulWords: string[] = [];
  const stems: string[] = [];

  for (const word of rawWords) {
    if (word.length < 3) continue;
    if (AGRONOMY_STOPWORDS.has(word)) continue;

    meaningfulWords.push(word);
    const stem = STEM_MAP[word] || word;
    if (!stems.includes(stem)) {
      stems.push(stem);
    }
  }

  return {
    phrases: matchedPhrases,
    words: meaningfulWords,
    stems,
  };
}

/**
 * Menghasilkan 7 langkah penanganan PHT berbasis 4 Pilar PHT resmi dari pustaka OPT
 */
export function buildPhtSteps(opt: Opt): PhtStepItem[] {
  const steps: PhtStepItem[] = [];

  // Langkah 1: Pengamatan & Konfirmasi Lapang
  steps.push({
    stepNumber: 1,
    categoryTitle: 'Pengamatan & Ambang Batas',
    actionTitle: 'Konfirmasi Lapang & Periksa Ambang Kendali',
    description:
      opt.economicThreshold ||
      opt.monitoringMethod ||
      'Lakukan pengamatan sampel diagonal pada 20 rumpun untuk mengukur populasi dan intensitas serangan sebelum tindakan korektif.',
  });

  // Langkah 2: Kultur Teknis
  steps.push({
    stepNumber: 2,
    categoryTitle: 'Kultur Teknis',
    actionTitle: 'Pengaturan Pola Tanam & Nutrisi Berimbang',
    description:
      opt.culturalControl ||
      'Terapkan tanam serempak dalam satu hamparan, perlebar jarak tanam (Jajar Legowo), dan hindari pemupukan Nitrogen berlebih.',
  });

  // Langkah 3: Sanitasi Lingkungan
  steps.push({
    stepNumber: 3,
    categoryTitle: 'Sanitasi Lapang',
    actionTitle: 'Pembersihan Inang Alternatif & Sisa Tanaman',
    description:
      'Bersihkan rumput inang dan gulma di pematang, saluran air, serta musnahkan sisa jerami/singgang terinfeksi.',
  });

  // Langkah 4: Pengaturan Air (Jika Relevan)
  const isBphOrBlas = opt.id.includes('wereng') || opt.id.includes('blas') || opt.id.includes('bakteri');
  steps.push({
    stepNumber: 4,
    categoryTitle: 'Tata Kelola Air',
    actionTitle: isBphOrBlas ? 'Pengeringan Berkala (Intermittent / AWD)' : 'Pengaturan Genangan Air Optimal',
    description: isBphOrBlas
      ? 'Keringkan petak sawah selama 3-5 hari untuk menurunkan kelembapan mikro di sekitar pangkal rumpun dan memperkuat aerasi akar.'
      : 'Atur ketinggian air sawah pada kondisi macak-macak (1-2 cm) guna mendukung ketahanan fisiologis tanaman.',
  });

  // Langkah 5: Pengendalian Mekanis / Fisik
  steps.push({
    stepNumber: 5,
    categoryTitle: 'Fisik & Mekanis',
    actionTitle: 'Pemasangan Perangkap & Eradikasi Manual',
    description:
      opt.mechanicalControl ||
      'Kumpulkan dan musnahkan kelompok telur/larva secara manual, pasang lampu perangkap atau pelindung fisik bila diperlukan.',
  });

  // Langkah 6: Pemanfaatan Musuh Alami
  steps.push({
    stepNumber: 6,
    categoryTitle: 'Hayati & Musuh Alami',
    actionTitle: 'Konservasi Predator & Parasitoid Lapang',
    description:
      opt.biologicalControl ||
      'Lestarikan musuh alami alami seperti laba-laba pemburu, kumbang kubah, kepik pemangsa, dan parasitoid telur dengan membatasi insektisida kimia spektrum luas.',
  });

  // Langkah 7: Monitoring & Evaluasi
  steps.push({
    stepNumber: 7,
    categoryTitle: 'Monitoring & Evaluasi',
    actionTitle: 'Evaluasi Perkembangan 3-5 Hari Pasca Tindakan',
    description:
      'Lakukan pemantauan ulang secara berkala untuk mengevaluasi apakah populasi OPT menurun dan tanaman membentuk anakan/pucuk baru yang sehat.',
  });

  return steps;
}

/**
 * Menyusun rujukan bahan aktif kimia (Opsi Lanjutan) yang berakar dari master data
 */
export function buildChemicalOptions(opt: Opt): ChemicalControlOption {
  const hasData = Boolean(opt.activeIngredients && opt.activeIngredients.length > 0);

  return {
    hasChemicalData: hasData,
    activeIngredients: opt.activeIngredients || [],
    resistanceNotes: opt.resistanceNotes,
    cautionaryNotice:
      'Informasi bahan aktif di bawah merupakan rujukan pilihan pengendalian. Penggunaan perlu disesuaikan dengan label produk yang terdaftar, kondisi lapang, dan ketentuan yang berlaku.',
  };
}

/**
 * Evaluasi relevansi satu OPT terhadap query pengamatan
 */
export function calculateOptScore(
  opt: Opt,
  query: string,
  tokens: { phrases: string[]; words: string[]; stems: string[] },
  options?: OptSearchOptions
): {
  score: number;
  matchedKeywords: string[];
  matchedVisualClues: string[];
  matchedLocations: string[];
  matchedSymptoms: string[];
  isExactMatch: boolean;
} {
  let score = 0;
  const matchedKeywords = new Set<string>();
  const matchedVisualClues = new Set<string>();
  const matchedLocations = new Set<string>();
  const matchedSymptoms = new Set<string>();

  const normalizedQuery = normalizeText(query);
  const normCommon = normalizeText(opt.commonName);
  const normScientific = normalizeText(opt.scientificName || '');
  const normAliases = (opt.aliases || []).map(normalizeText);
  const normSymptoms = normalizeText(opt.symptoms);
  const normVulnerable = normalizeText(opt.vulnerableStage || '');
  const normControl = normalizeText(
    `${opt.culturalControl || ''} ${opt.mechanicalControl || ''} ${opt.biologicalControl || ''} ${opt.chemicalControl || ''}`
  );
  const normTriggers = normalizeText((opt.triggerFactors || []).join(' '));

  // 1. Exact Match Substring pada Nama atau Alias
  if (normalizedQuery.length >= 3) {
    if (normCommon.includes(normalizedQuery)) {
      score += 150;
      matchedKeywords.add(opt.commonName);
    }
    if (normScientific.includes(normalizedQuery)) {
      score += 130;
      matchedKeywords.add(opt.scientificName || '');
    }
    for (const alias of normAliases) {
      if (alias.includes(normalizedQuery) || normalizedQuery.includes(alias)) {
        score += 140;
        matchedKeywords.add(alias);
      }
    }
  }

  const isExact = score >= 130;

  // 2. Phrase Matching (Frasa Gejala Agronomi)
  for (const phrase of tokens.phrases) {
    let phraseMatched = false;

    if (normSymptoms.includes(phrase)) {
      score += 65;
      matchedKeywords.add(phrase);
      matchedSymptoms.add(phrase);
      phraseMatched = true;
    }
    if (normCommon.includes(phrase)) {
      score += 45;
      matchedKeywords.add(phrase);
      phraseMatched = true;
    }
    if (normAliases.some((a) => a.includes(phrase))) {
      score += 55;
      matchedKeywords.add(phrase);
      phraseMatched = true;
    }
    if (!phraseMatched && (normTriggers.includes(phrase) || normControl.includes(phrase))) {
      score += 20;
      matchedKeywords.add(phrase);
    }
  }

  // 3. Token & Stem Matching
  const matchedStemCount = new Set<string>();

  for (const stem of tokens.stems) {
    let stemHit = false;

    // Kecocokan pada Nama Umum
    if (normCommon.includes(stem)) {
      score += 25;
      matchedKeywords.add(stem);
      stemHit = true;
    }

    // Kecocokan pada Alias
    if (normAliases.some((a) => a.includes(stem))) {
      score += 25;
      matchedKeywords.add(stem);
      stemHit = true;
    }

    // Kecocokan pada Gejala (Symptoms)
    if (normSymptoms.includes(stem)) {
      score += 15;
      matchedKeywords.add(stem);
      matchedSymptoms.add(stem);
      stemHit = true;
    }

    // Kecocokan pada Fase Rentan
    if (normVulnerable.includes(stem)) {
      score += 8;
      matchedKeywords.add(stem);
      stemHit = true;
    }

    // Kecocokan pada Pemicu & Pengendalian
    if (normTriggers.includes(stem) || normControl.includes(stem)) {
      score += 6;
      stemHit = true;
    }

    if (stemHit) {
      matchedStemCount.add(stem);
    }
  }

  // 4. Plant Part / Attack Location Context Synergy
  const targetLocations = options?.attackLocations || [];
  for (const loc of targetLocations) {
    const locStr = String(loc).toUpperCase();
    let partKeyword = '';
    let labelLoc = '';
    if (locStr.includes('LEAF') || locStr === 'DAUN') {
      partKeyword = 'daun';
      labelLoc = 'Daun / Pelepah';
    } else if (locStr.includes('STEM') || locStr === 'BATANG') {
      partKeyword = 'batang';
      labelLoc = 'Batang / Pangkal';
    } else if (locStr.includes('ROOT') || locStr === 'AKAR') {
      partKeyword = 'akar';
      labelLoc = 'Akar Tanaman';
    } else if (locStr.includes('PANICLE') || locStr === 'MALAI' || locStr === 'BULIR') {
      partKeyword = 'malai';
      labelLoc = 'Malai / Bulir';
    } else if (locStr.includes('SEEDLING') || locStr === 'BIBIT') {
      partKeyword = 'bibit';
      labelLoc = 'Pesemaian / Bibit';
    }

    if (partKeyword && (normSymptoms.includes(partKeyword) || normCommon.includes(partKeyword))) {
      score += 15;
      matchedKeywords.add(`bagian ${partKeyword}`);
      matchedLocations.add(labelLoc || partKeyword);
    }
  }

  // 5. Visual Tokens & Visual Clues from Photo (Penguat Relevansi Tambahan)
  const visualTokens = options?.visualTokens || [];
  for (const vToken of visualTokens) {
    const normV = normalizeText(vToken);
    if (!normV) continue;

    if (normSymptoms.includes(normV) || normCommon.includes(normV)) {
      score += 15;
      matchedVisualClues.add(vToken);
      matchedKeywords.add(`visual: ${vToken}`);
    }
  }

  // 6. Cross-Symptom Synergy Bonus (Jika terdapat >= 2 gejala spesifik yang cocok bersamaan)
  if (matchedStemCount.size >= 2) {
    score += 25;
  }
  if (matchedStemCount.size >= 3) {
    score += 20;
  }

  return {
    score,
    matchedKeywords: Array.from(matchedKeywords),
    matchedVisualClues: Array.from(matchedVisualClues),
    matchedLocations: Array.from(matchedLocations),
    matchedSymptoms: Array.from(matchedSymptoms),
    isExactMatch: isExact,
  };
}

/**
 * Mencari rujukan OPT di pustaka dengan perangkingan skor relevansi bertingkat
 */
export function matchOptRelevance(
  opts: Opt[],
  query: string,
  options?: OptSearchOptions
): OptRelevanceMatch[] {
  const minThreshold = options?.minScoreThreshold ?? 8;
  const categoryFilter = options?.category || 'ALL';

  // Gabungkan query utama dengan visual tokens jika ada
  const visualTokensStr = (options?.visualTokens || []).join(' ');
  const combinedQuery = `${query} ${visualTokensStr}`.trim();
  const tokens = extractAgronomicTokens(combinedQuery);

  const rawQuery = query.trim();

  // Jika query dan visual tokens kosong dan tidak ada target lokasi khusus
  if (
    !rawQuery &&
    (!options?.visualTokens || options.visualTokens.length === 0) &&
    (!options?.attackLocations || options.attackLocations.length === 0)
  ) {
    return opts
      .filter((opt) => categoryFilter === 'ALL' || opt.category === categoryFilter)
      .map((opt) => ({
        opt,
        score: 0,
        matchedKeywords: [],
        matchedVisualClues: [],
        matchedLocations: [],
        matchedSymptoms: [],
        isExactMatch: false,
        relevanceLabel: 'Katalog Pustaka',
        similarityReason: 'Daftar rujukan literasi HIKMAT TANI.',
        disclaimer: 'Gunakan sebagai referensi budidaya dan pemantauan lapang.',
        phtSteps: buildPhtSteps(opt),
        chemicalOptions: buildChemicalOptions(opt),
      }));
  }

  const results: OptRelevanceMatch[] = [];

  for (const opt of opts) {
    // Filter Kategori bila ditentukan
    if (categoryFilter !== 'ALL' && opt.category !== categoryFilter) {
      continue;
    }

    const {
      score,
      matchedKeywords,
      matchedVisualClues,
      matchedLocations,
      matchedSymptoms,
      isExactMatch,
    } = calculateOptScore(opt, combinedQuery, tokens, options);

    if (score >= minThreshold) {
      let relevanceLabel = 'Rujukan Pembanding • Gejala Mirip';
      if (isExactMatch) {
        relevanceLabel = 'Rujukan Terdaftar';
      } else if (score >= 50) {
        relevanceLabel = 'Rujukan Pembanding • Gejala Sangat Mirip';
      }

      const keywordsText = matchedKeywords.slice(0, 3).join(', ');
      const similarityReason = isExactMatch
        ? `Sesuai dengan nama atau sebutan OPT "${opt.commonName}".`
        : keywordsText
        ? `Memiliki kemiripan karakter gejala pada: ${keywordsText}.`
        : 'Memiliki kemiripan karakteristik lapang dengan pengamatan Anda.';

      results.push({
        opt,
        score,
        matchedKeywords,
        matchedVisualClues,
        matchedLocations,
        matchedSymptoms,
        isExactMatch,
        relevanceLabel,
        similarityReason,
        disclaimer: isExactMatch
          ? 'Panduan PHT resmi Ditlin Kementan RI & BBPadi.'
          : 'Rujukan ini ditampilkan sebagai pembanding karena memiliki gejala yang mirip dengan pengamatan Anda. Ini bukan diagnosis pasti.',
        phtSteps: buildPhtSteps(opt),
        chemicalOptions: buildChemicalOptions(opt),
      });
    }
  }

  // Urutkan berdasarkan skor tertinggi (Rank Descending)
  return results.sort((a, b) => b.score - a.score);
}
