/**
 * HIKMAT TANI - Seed Data Awal (Starter / Review Data)
 * 
 * Status: REVIEW (Data starter untuk pengembangan awal sebelum validasi lapangan penuh).
 * Setiap data menyertakan rujukan referensi ilmiah.
 */

import {
  Fertilizer,
  KnowledgeArticle,
  NaturalEnemy,
  Opt,
  Reference,
  RiceVariety,
} from '../types/index.ts';

export const SEED_REFERENCES: Reference[] = [
  {
    id: 'ref-litbang-padi-2020',
    title: 'Petunjuk Teknis Budidaya Padi Sawah Irigasi Berorientasi IP 400',
    authorInstitution: 'Balai Besar Penelitian Tanaman Padi (BBPadi) - Badan Litbang Pertanian',
    publicationYear: 2020,
    sourceUrlOrBook: 'Buku Juknis BBPadi Sukamandi',
    regionApplicability: 'Nasional / Sawah Irigasi',
    validationStatus: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ref-pht-padi-2019',
    title: 'Pedoman Pengendalian Hama Terpadu (PHT) Tanaman Padi',
    authorInstitution: 'Direktorat Perlindungan Tanaman Pangan, Kementan RI',
    publicationYear: 2019,
    sourceUrlOrBook: 'Buku Pedoman Ditlin Tanaman Pangan',
    regionApplicability: 'Nasional',
    validationStatus: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ref-pupuk-kementan-2021',
    title: 'Daftar Pupuk Terdaftar dan Rekomendasi Pemupukan Spesifik Lokasi',
    authorInstitution: 'Balai Penelitian Tanah - Badan Litbang Pertanian',
    publicationYear: 2021,
    sourceUrlOrBook: 'Permentan Rekomendasi Pupuk N, P, K Spesifik Lokasi',
    regionApplicability: 'Nasional',
    validationStatus: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ref-irri-rice-knowledge',
    title: 'Rice Knowledge Bank - AWD Water Management and Pest Ecology',
    authorInstitution: 'International Rice Research Institute (IRRI)',
    publicationYear: 2022,
    sourceUrlOrBook: 'IRRI Agronomy Series',
    regionApplicability: 'Asia Tenggara / Tropis',
    validationStatus: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ref-brin-varietas-2023',
    title: 'Deskripsi Varietas Unggul Baru Padi Sawah dan Ketahanan Cekaman Biotik',
    authorInstitution: 'Pusat Riset Tanaman Pangan - BRIN',
    publicationYear: 2023,
    sourceUrlOrBook: 'Laporan Riset Varietas Padi BRIN',
    regionApplicability: 'Nasional',
    validationStatus: 'REVIEW',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const SEED_FERTILIZERS: Fertilizer[] = [
  {
    id: 'fert-urea',
    name: 'Urea (Prill/Granul)',
    type: 'INORGANIC_SINGLE',
    formula: '46-0-0',
    nutrientComposition: { N: 46 },
    aliases: ['Urea', 'Nitrogen', 'Pupuk Putih'],
    referenceId: 'ref-pupuk-kementan-2021',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'fert-sp36',
    name: 'SP-36 (Super Phosphate)',
    type: 'INORGANIC_SINGLE',
    formula: '0-36-0 + 5S',
    nutrientComposition: { P2O5: 36, S: 5 },
    aliases: ['SP36', 'SP-36', 'Fosfat'],
    referenceId: 'ref-pupuk-kementan-2021',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'fert-kcl',
    name: 'KCl (Kalium Klorida / MOP)',
    type: 'INORGANIC_SINGLE',
    formula: '0-0-60',
    nutrientComposition: { K2O: 60 },
    aliases: ['KCl', 'MOP', 'Pupuk Merah', 'Kalium'],
    referenceId: 'ref-pupuk-kementan-2021',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'fert-za',
    name: 'ZA (Zwavelzure Amoniak)',
    type: 'INORGANIC_SINGLE',
    formula: '21-0-0 + 24S',
    nutrientComposition: { N: 21, S: 24 },
    aliases: ['ZA', 'Amonium Sulfat'],
    referenceId: 'ref-pupuk-kementan-2021',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'fert-npk-ponska',
    name: 'NPK Phonska (15-15-15 + 10S)',
    type: 'INORGANIC_COMPOUND',
    formula: '15-15-15 + 10S',
    nutrientComposition: { N: 15, P2O5: 15, K2O: 15, S: 10 },
    aliases: ['Phonska', 'NPK Phonska', 'NPK 15-15-15'],
    referenceId: 'ref-pupuk-kementan-2021',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'fert-kompos-kandang',
    name: 'Pupuk Kandang Sapi Matang / Kompos',
    type: 'ORGANIC',
    formula: 'Organik Terfermentasi',
    nutrientComposition: { N: 1.5, P2O5: 1.0, K2O: 1.5, Ca: 0.8, Mg: 0.5 },
    aliases: ['Pukan', 'Pupuk Kandang', 'Kohe Sapi', 'Kompos'],
    referenceId: 'ref-litbang-padi-2020',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const SEED_VARIETIES: RiceVariety[] = [
  {
    id: 'var-inpari-32',
    name: 'Inpari 32 HDB',
    aliases: ['Inpari 32', 'Ciherang Baru'],
    growthDurationDays: 120,
    potentialYieldKgHa: 8420,
    resistanceProfile: 'Tahan Hawar Daun Bakteri (HDB) strain III, IV, VIII; Agak tahan Blas',
    referenceId: 'ref-litbang-padi-2020',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'var-ciherang',
    name: 'Ciherang',
    aliases: ['Ciherang Asli', 'IR64 Pilihan'],
    growthDurationDays: 116,
    potentialYieldKgHa: 8500,
    resistanceProfile: 'Tahan Wereng Batang Coklat biotipe 2 dan 3; Agak tahan HDB strain III',
    referenceId: 'ref-litbang-padi-2020',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'var-inpari-42',
    name: 'Inpari 42 Agritan GSR',
    aliases: ['Inpari 42', 'Green Super Rice'],
    growthDurationDays: 112,
    potentialYieldKgHa: 10580,
    resistanceProfile: 'Tahan Blas, Tahan HDB strain III, Toleran kekeringan/efisiensi hara',
    referenceId: 'ref-litbang-padi-2020',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const SEED_OPTS: Opt[] = [
  {
    id: 'opt-penggerek-kuning',
    commonName: 'Penggerek Batang Padi Kuning (PBPK)',
    scientificName: 'Scirpophaga incertulas',
    category: 'INSECT_PEST',
    aliases: ['Sundep', 'Beluk', 'Ulat Penggerek', 'Kaper'],
    symptoms: 'Fase vegetatif: pucuk mati/kering mudah dicabut (Sundep). Fase generatif: malai hampa keputihan tegak (Beluk).',
    lifeCycle: 'Telur (6-7 hari) -> Larva (28-35 hari) -> Pupa (6-9 hari) -> Ngengat (4-5 hari). Total 40-55 hari.',
    hostPlants: ['Padi', 'Padi liar'],
    vulnerableStage: 'Vegetatif (Pembentukan Anakan) & Primordia/Bunting',
    triggerFactors: ['Pemupukan Urea/N berlebih', 'Penanaman tidak serempak', 'Lampu penerangan malam dekat sawah'],
    monitoringMethod: 'Amati rumpun contoh secara diagonal; hitung jumlah kelompok telur dan persentase anakan sundep/beluk.',
    economicThreshold: 'Rata-rata 1 kelompok telur per rumpun atau serangan sundep > 5% pada fase vegetatif.',
    culturalControl: 'Tanam serempak dalam hamparan, potong ujung bibit sebelum tanam, atur pemupukan N seimbang.',
    mechanicalControl: 'Kumpulkan dan musnahkan kelompok telur, gunakan perangkap lampu (light trap).',
    biologicalControl: 'Konservasi parasitoid telur Trichogramma spp., Telenomus rowani, dan laba-laba pemburu.',
    chemicalControl: 'Gunakan insektisida sistemik berbahan aktif terdaftar jika ambang pengendalian terlampaui.',
    activeIngredients: ['Klorantraniliprol', 'Dimehipo', 'Fipronil', 'Kartap Hidroklorida'],
    resistanceNotes: 'Hindari penggunaan bahan aktif golongan sama berturut-turut.',
    referenceId: 'ref-pht-padi-2019',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'opt-wereng-coklat',
    commonName: 'Wereng Batang Coklat (WBC)',
    scientificName: 'Nilaparvata lugens',
    category: 'INSECT_PEST',
    aliases: ['Wereng Coklat', 'WBC', 'Hopperburn'],
    symptoms: 'Tanaman menguning, mengering cepat seperti terbakar melingkar (Hopperburn); vektor virus kerdil rumput & kerdil hampa.',
    lifeCycle: 'Telur (7-9 hari) -> Nimfa 5 instar (12-15 hari) -> Imago dewasa (18-20 hari).',
    hostPlants: ['Padi'],
    vulnerableStage: 'Fase Anakan Maksimum hingga Pematangan',
    triggerFactors: ['Penggunaan pestisida piretroid sintetik yang mematikan musuh alami', 'Aplikasi pupuk N berlebih', 'Jarak tanam terlalu rapat tanpa jeda'],
    monitoringMethod: 'Periksa pangkal batang padi di bawah kanopi daun pada 20 rumpun sampel secara acak.',
    economicThreshold: 'Kepadatan rata-rata >= 10 ekor per rumpun pada fase vegetatif, atau >= 20 ekor per rumpun pada fase generatif.',
    culturalControl: 'Tanam varietas tahan, gunakan sistem tanam Jajar Legowo, pengairan berselang (intermittent/keringkan sawah berkala).',
    mechanicalControl: 'Pengeringan petak sawah selama 3-5 hari untuk menurunkan kelembapan mikro kanopi.',
    biologicalControl: 'Laba-laba Pardosa pseudoannulata, kumbang Paederus fuscipes, kepik Cyrtorhinus lividipennis, jamur Beauveria bassiana.',
    chemicalControl: 'Insektisida spesifik penghambat pertumbuhan (IGR) atau sistemik bila di atas ambang batas.',
    activeIngredients: ['Buprofezin', 'Pimetrozin', 'Triflumuron', 'Imidakloprid'],
    resistanceNotes: 'Sangat rentan meledak (resurgensi) jika disemprot pestisida spektrum luas yang salah.',
    referenceId: 'ref-pht-padi-2019',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'opt-hawar-daun-bakteri',
    commonName: 'Hawar Daun Bakteri (HDB / Kresek)',
    scientificName: 'Xanthomonas oryzae pv. oryzae',
    category: 'DISEASE',
    aliases: ['Kresek', 'HDB', 'Hawar Daun'],
    symptoms: 'Bercak kuning kebasahan mulai dari pucuk/tepi daun, meluas menjadi kelabu keputihan berombak; daun layu mengering.',
    lifeCycle: 'Bakteri bertahan pada sisa jerami sakit, gulma inang, dan benih; menular lewat luka tanaman dan air irigasi.',
    hostPlants: ['Padi', 'Gulma Leersia hexandra'],
    vulnerableStage: 'Semua fase, terutama Anakan Aktif hingga Berbunga',
    triggerFactors: ['Kelembapan tinggi (>85%), angin kencang disertai hujan, dosis pupuk Urea/N berlebih tanpa imbangan K.'],
    monitoringMethod: 'Amati luas permukaan daun yang bergejala pada petak sawah.',
    economicThreshold: 'Kerusakan daun > 10% pada fase anakan atau > 5% pada fase bunting.',
    culturalControl: 'Gunakan varietas tahan (misal Inpari 32), hindari pemotongan akar/bibit kasar, kurangi N, tambah pupuk K (KCl).',
    mechanicalControl: 'Sanitasi gulma galengan dan pemusnahan singgang terinfeksi.',
    biologicalControl: 'Aplikasi bakteri antagonis Paenibacillus polymyxa atau Pseudomonas fluorescens.',
    chemicalControl: 'Bakterisida tembaga atau antibiotik pertanian terdaftar bila sangat mendesak.',
    activeIngredients: ['Tembaga Hidroksida', 'Kasugamisin', 'Asam Oksolinik'],
    referenceId: 'ref-litbang-padi-2020',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'opt-blas-padi',
    commonName: 'Penyakit Blas Padi',
    scientificName: 'Pyricularia oryzae (Magnaporthe oryzae)',
    category: 'DISEASE',
    aliases: ['Blas Daun', 'Blas Leher', 'Patah Leher', 'Tengik'],
    symptoms: 'Bercak berbentuk belah ketupat runcing di ujung pada daun; tangkai malai membusuk kelabu kehitaman patah (Blas Leher).',
    lifeCycle: 'Spora jamur disebarkan lewat angin dan embun pagi pada malam yang dingin lembap.',
    hostPlants: ['Padi'],
    vulnerableStage: 'Vegetatif Awal (Blas Daun) & Fase Pembungaan (Blas Leher)',
    triggerFactors: ['Kelebihan pupuk N, tanah kurang silika (Si), kelembapan malam tinggi dengan kabut tebal.'],
    monitoringMethod: 'Periksa daun bawah dan leher malai pada rumpun contoh.',
    economicThreshold: 'Gejala bercak belah ketupat aktif pada daun bendera atau tanda awal infeksi leher malai.',
    culturalControl: 'Perlakuan benih (seed treatment), jarak tanam tidak terlalu rapat, pergiliran varietas.',
    mechanicalControl: 'Eradikasi rumpun terinfeksi parah di pesemaian.',
    biologicalControl: 'Pemanfaatan agens hayati Trichoderma spp.',
    chemicalControl: 'Fungisida sistemik berbahan aktif spesifik saat awal pembungaan (keluar malai 5%).',
    activeIngredients: ['Trisiklazol', 'Isoprotiolan', 'Azoksistrobin', 'Difenokonazol'],
    referenceId: 'ref-litbang-padi-2020',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const SEED_NATURAL_ENEMIES: NaturalEnemy[] = [
  {
    id: 'enemy-laba-serigala',
    name: 'Laba-laba Serigala Pemburu',
    scientificName: 'Pardosa pseudoannulata',
    type: 'PREDATOR',
    targetOptIds: ['opt-wereng-coklat', 'opt-penggerek-kuning'],
    attackedStages: ['Nimfa', 'Imago/Dewasa'],
    habitat: 'Pangkal batang padi dan permukaan air sawah.',
    conservationNotes: 'Pertahankan petak sawah dari aplikasi insektisida semprotan langsung ke pangkal batang jika populasi laba-laba tinggi (1 ekor/rumpun).',
    referenceId: 'ref-pht-padi-2019',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'enemy-kumbang-kubah',
    name: 'Kumbang Kubah Bergaris',
    scientificName: 'Micraspis crocea',
    type: 'PREDATOR',
    targetOptIds: ['opt-wereng-coklat'],
    attackedStages: ['Telur', 'Nimfa'],
    habitat: 'Kanopi daun bagian atas dan malai.',
    conservationNotes: 'Tanam tanaman refugia berbunga kuning (misal kenikir, bunga tahi ayam) di pematang sawah sebagai sumber nektar alternatif.',
    referenceId: 'ref-pht-padi-2019',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'enemy-trichogramma',
    name: 'Tawon Parasitoid Telur',
    scientificName: 'Trichogramma japonicum',
    type: 'PARASITOID',
    targetOptIds: ['opt-penggerek-kuning'],
    attackedStages: ['Telur'],
    habitat: 'Bebas terbang di kanopi persawahan.',
    conservationNotes: 'Sangat rentan terhadap kabut insektisida kimia; hindari penyemprotan rutin terjadwal.',
    referenceId: 'ref-pht-padi-2019',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'enemy-kepik-mirid',
    name: 'Kepik Mirid Pemangsa Telur',
    scientificName: 'Cyrtorhinus lividipennis',
    type: 'PREDATOR',
    targetOptIds: ['opt-wereng-coklat'],
    attackedStages: ['Telur', 'Nimfa muda'],
    habitat: 'Pangkal batang dan pelepah daun padi.',
    conservationNotes: 'Kepik ini sangat efektif memangsa telur wereng di dalam jaringan pelepah.',
    referenceId: 'ref-pht-padi-2019',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const SEED_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'art-pupuk-berimbang',
    category: 'FERTILIZATION',
    title: 'Prinsip Dasar Pemupukan Padi Berimbang (5T)',
    summary: 'Panduan pemupukan padi yang tepat jenis, tepat dosis, tepat waktu, tepat cara, dan tepat mutu.',
    content: `Pemupukan berimbang adalah pemberian pupuk ke dalam tanah dengan jumlah dan jenis hara yang sesuai dengan tingkat kesuburan tanah dan kebutuhan tanaman.

Prinsip 5 Tepat:
1. Tepat Jenis: Memberikan pupuk sesuai kekurangan unsur (N, P, K, S, dll).
2. Tepat Dosis: Menyesuaikan target hasil dan kemampuan tanah, menghindari kelebihan Urea yang memicu rebah dan serangan hama.
3. Tepat Waktu: Diberikan pada fase tanaman membutuhkan serapan aktif (Dasar/Awal, Anakan Aktif, dan Primordia/Bunting).
4. Tepat Cara: Ditabur saat kondisi macak-macak atau dibenamkan agar tidak hilang terbawa air.
5. Tepat Mutu: Menggunakan pupuk resmi berlabel legalitas jelas.`,
    tags: ['Pemupukan', 'Hara', 'Urea', 'NPK', 'Dasar'],
    referenceId: 'ref-litbang-padi-2020',
    verifiedDate: '2026-01-15T00:00:00.000Z',
    status: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'art-pht-dasar',
    category: 'PEST_DISEASE',
    title: 'Prinsip Pengendalian Hama Terpadu (PHT) pada Padi Sawah',
    summary: 'Mengenal konsep PHT: budidaya tanaman sehat, pelestarian musuh alami, dan pengamatan mingguan.',
    content: `Pengendalian Hama Terpadu (PHT) bukan berarti tidak boleh menyemprot pestisida, melainkan menempatkan pestisida kimia sebagai jalan terakhir jika ambang batas ekonomi telah dilampaui.

4 Pilar Utama PHT:
1. Budidaya Tanaman Sehat: Benih unggul bermutu, jarak tanam teratur (Jajar Legowo), pemupukan berimbang.
2. Pelestarian Musuh Alami: Menjaga populasi predator alami (laba-laba, parasitoid) dengan menanam tanaman berbunga (refugia).
3. Pengamatan Mingguan Rutin: Petani memantau sawahnya seminggu sekali untuk mengetahui perkembangan populasi hama dan musuh alami secara dini.
4. Petani Sebagai Ahli PHT di Lahannya: Petani mengambil keputusan pengendalian secara mandiri berdasarkan data lapangan nyata.`,
    tags: ['PHT', 'OPT', 'Musuh Alami', 'Pengamatan'],
    referenceId: 'ref-pht-padi-2019',
    verifiedDate: '2026-01-15T00:00:00.000Z',
    status: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'art-jajar-legowo',
    category: 'CULTIVATION',
    title: 'Sistem Tanam Jajar Legowo 2:1 untuk Padi Sawah',
    summary: 'Meningkatkan populasi tanaman hingga 33% dan menciptakan efek tanaman pinggir yang lebih produktif.',
    content: `Sistem tanam Jajar Legowo 2:1 adalah cara tanam berselang antara dua baris tanaman dan satu baris kosong dengan jarak antar baris 20-25 cm dan jarak dalam baris 10-12.5 cm.

Manfaat Utama:
1. Menambah populasi rumpun tanaman per hektar.
2. Memanfaatkan efek tepi (border effect) di mana semua tanaman di pinggir lorong mendapat sinar matahari optimal.
3. Memudahkan pemupukan, penyiangan, dan pengamatan OPT di sepanjang lorong kosong.
4. Menurunkan kelembapan kanopi mikro sehingga menekan perkembangan jamur Blas dan Hawar Daun Bakteri.`,
    tags: ['Budidaya', 'Jajar Legowo', 'Tanam', 'Populasi'],
    referenceId: 'ref-litbang-padi-2020',
    verifiedDate: '2026-01-20T00:00:00.000Z',
    status: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'art-pengairan-berselang',
    category: 'IRRIGATION',
    title: 'Pengairan Berselang (Intermittent / AWD) pada Sawah',
    summary: 'Pengaturan air sawah secara berselang untuk menghemat air 20-30% dan merangsang perakaran yang lebih dalam.',
    content: `Pengairan berselang (Alternate Wetting and Drying / AWD) adalah teknik pengaturan air kondisi tergenang dan kering secara bergantian sesuai fase pertumbuhan tanaman.

Tahapan Aplikasi:
- 0-7 HST: Tergenang dangkal (1-2 cm) untuk adaptasi bibit baru.
- 8-35 HST (Anakan): Kondisi macak-macak hingga berselang; biarkan air surut sampai permukaan tanah sedikit retak rambut (bukan retak belah).
- 40-65 HST (Bunting - Berbunga): Wajib tergenang dangkal (3-5 cm) karena tanaman sangat butuh air untuk pengisian sari.
- 70-85 HST (Pemasakan Bulir): Berselang kembali (macak-macak).
- 10-14 Hari Sebelum Panen: Keringkan petak sawah sepenuhnya untuk mempercepat kematangan serempak dan mempermudah panen.`,
    tags: ['Irigasi', 'Air Berselang', 'AWD', 'Macak-Macak'],
    referenceId: 'ref-irri-rice-knowledge',
    verifiedDate: '2026-01-20T00:00:00.000Z',
    status: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'art-panen-pasca-panen',
    category: 'HARVEST',
    title: 'Tanda Kematangan Optimal & Penanganan Panen Padi',
    summary: 'Mencegah kehilangan hasil saat panen dengan menentukan umur panen dan kadar air gabah yang tepat.',
    content: `Waktu panen yang tepat sangat menentukan mutu beras (rendemen beras kepala dan menekan beras patah).

Tanda Padi Siap Panen:
1. 90-95% bulir padi pada malai telah menguning.
2. Daun bendera telah menguning atau mengering.
3. Batang bawah mulai mengering tetapi tidak rebah.
4. Umur tanaman telah mencapai deskripsi varietas (misal Inpari 32 sekitar 115-120 HST).
5. Kadar air gabah ideal saat panen sekitar 21-24%.`,
    tags: ['Panen', 'Kadar Air', 'GKP', 'Rendemen'],
    referenceId: 'ref-litbang-padi-2020',
    verifiedDate: '2026-01-20T00:00:00.000Z',
    status: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
