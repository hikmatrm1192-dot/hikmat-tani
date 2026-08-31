/**
 * HIKMAT TANI - Agronomic OPT Relevance & Reference Matching Engine
 * 
 * Prinsip:
 * 1. Tidak membuat diagnosis palsu atau mengubah "belum tahu" menjadi diagnosis pasti.
 * 2. Menemukan rujukan agronomi terdaftar yang paling relevan berdasarkan kombinasi:
 *    - nama sementara / catatan bebas
 *    - deskripsi gejala lapang (symptoms)
 *    - bagian tanaman yang terserang (attackLocation)
 *    - sinonim/alias lokal
 *    - literasi gejala & pemicu di pustaka HIKMAT TANI
 * 3. Menghilangkan noise/stopwords non-agronomi (e.g., 'tanaman', 'terlihat', 'petak', 'sawah', 'dan', 'di').
 * 4. Memberi bobot tinggi pada kata/frasa agronomi spesifik (e.g., 'daun menguning', 'rumpun kerdil', 'bercak', 'sundep').
 * 5. Deterministic, offline-first, tanpa ketergantungan jaringan eksternal.
 */

import { AttackLocation, Opt, OptCategory } from '../types/index.ts';

export interface OptRelevanceMatch {
  opt: Opt;
  score: number;
  matchedKeywords: string[];
  isExactMatch: boolean;
  relevanceLabel: string;
  similarityReason: string;
  disclaimer: string;
}

export interface OptSearchOptions {
  attackLocations?: (AttackLocation | string)[];
  category?: OptCategory | 'ALL' | string;
  minScoreThreshold?: number;
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
  'sundep',
  'beluk',
  'malai hampa',
  'bulir hampa',
  'malai putih',
  'bercak belah ketupat',
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
 * Evaluasi relevansi satu OPT terhadap query pengamatan
 */
export function calculateOptScore(
  opt: Opt,
  query: string,
  tokens: { phrases: string[]; words: string[]; stems: string[] },
  options?: OptSearchOptions
): { score: number; matchedKeywords: string[]; isExactMatch: boolean } {
  let score = 0;
  const matchedKeywords = new Set<string>();
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
      score += 45;
      matchedKeywords.add(phrase);
      phraseMatched = true;
    }
    if (normCommon.includes(phrase)) {
      score += 40;
      matchedKeywords.add(phrase);
      phraseMatched = true;
    }
    if (normAliases.some((a) => a.includes(phrase))) {
      score += 45;
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
    if (locStr.includes('LEAF') || locStr === 'DAUN') partKeyword = 'daun';
    else if (locStr.includes('STEM') || locStr === 'BATANG') partKeyword = 'batang';
    else if (locStr.includes('ROOT') || locStr === 'AKAR') partKeyword = 'akar';
    else if (locStr.includes('PANICLE') || locStr === 'MALAI' || locStr === 'BULIR') partKeyword = 'malai';
    else if (locStr.includes('SEEDLING') || locStr === 'BIBIT') partKeyword = 'bibit';

    if (partKeyword && (normSymptoms.includes(partKeyword) || normCommon.includes(partKeyword))) {
      score += 12;
      matchedKeywords.add(`bagian ${partKeyword}`);
    }
  }

  // 5. Cross-Symptom Synergy Bonus (Jika terdapat >= 2 gejala spesifik yang cocok bersamaan)
  if (matchedStemCount.size >= 2) {
    score += 25;
  }
  if (matchedStemCount.size >= 3) {
    score += 20;
  }

  return {
    score,
    matchedKeywords: Array.from(matchedKeywords),
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

  const tokens = extractAgronomicTokens(query);
  const rawQuery = query.trim();

  // Jika query kosong dan tidak ada target lokasi khusus
  if (!rawQuery && (!options?.attackLocations || options.attackLocations.length === 0)) {
    return opts
      .filter((opt) => categoryFilter === 'ALL' || opt.category === categoryFilter)
      .map((opt) => ({
        opt,
        score: 0,
        matchedKeywords: [],
        isExactMatch: false,
        relevanceLabel: 'Katalog Pustaka',
        similarityReason: 'Daftar rujukan literasi HIKMAT TANI.',
        disclaimer: 'Gunakan sebagai referensi budidaya dan pemantauan lapang.',
      }));
  }

  const results: OptRelevanceMatch[] = [];

  for (const opt of opts) {
    // Filter Kategori bila ditentukan
    if (categoryFilter !== 'ALL' && opt.category !== categoryFilter) {
      continue;
    }

    const { score, matchedKeywords, isExactMatch } = calculateOptScore(
      opt,
      query,
      tokens,
      options
    );

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
        isExactMatch,
        relevanceLabel,
        similarityReason,
        disclaimer: isExactMatch
          ? 'Panduan PHT resmi Ditlin Kementan RI & BBPadi.'
          : 'Rujukan ini ditampilkan sebagai pembanding karena memiliki gejala yang mirip dengan pengamatan Anda. Ini bukan diagnosis pasti.',
      });
    }
  }

  // Urutkan berdasarkan skor tertinggi (Rank Descending)
  return results.sort((a, b) => b.score - a.score);
}
