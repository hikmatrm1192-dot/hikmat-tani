/**
 * HIKMAT TANI - Agricultural Weather Decision & Recommendation Engine
 * 
 * Prinsip:
 * 1. Mengintegrasikan data meteorologi ilmiah (1-10 hari, 2-4 minggu, 1-3 bulan)
 *    dengan data agronomi riil tanaman (HST, fase, pupuk, semprot, OPT, panen).
 * 2. Membedakan secara tegas antara:
 *    - Data Prakiraan (Faktual / Model)
 *    - Analisis Risiko (Kondisi Cuaca)
 *    - Rekomendasi Tindakan Pertanian (Saran Praktis)
 * 3. Bahasa santun, jelas, mudah dipahami petani lapang, dan berbasis Good Agricultural Practices (GAP).
 */

import {
  Activity,
  AgriWeatherRecommendation,
  CropSeason,
  FertilizerApplication,
  Land,
  OptObservation,
  RiceVariety,
  WeatherData,
} from '../types/index.ts';
import { calculateHST } from './hstCalculator.ts';
import { determineGrowthPhase, GrowthStageCategory } from './growthPhase.ts';

export interface WeatherAgriEvaluationInput {
  land?: Land | null;
  cropSeason?: CropSeason | null;
  activities?: Activity[];
  fertilizerApplications?: FertilizerApplication[];
  optObservations?: OptObservation[];
  varieties?: RiceVariety[];
  weatherData?: WeatherData | null;
  targetDate?: Date;
}

export interface WeatherAgriEvaluationResult {
  hst: number;
  growthPhaseName: string;
  stageCategory: GrowthStageCategory;
  daysToHarvest: number;
  activeLandName: string;
  locationDisplayName: string;
  recommendations: AgriWeatherRecommendation[];
  alerts: { title: string; desc: string; severity: 'INFO' | 'WARNING' | 'DANGER' }[];
  summary: string;
}

export class WeatherAgriEngine {
  /**
   * Evaluasi keterpaduan cuaca dan kondisi tanaman secara deterministik
   */
  public static evaluate(input: WeatherAgriEvaluationInput): WeatherAgriEvaluationResult {
    const targetDate = input.targetDate || new Date();
    const weather = input.weatherData;
    const land = input.land;
    const season = input.cropSeason;
    const activities = input.activities || [];
    const optObs = input.optObservations || [];
    const fertApps = input.fertilizerApplications || [];

    // 1. Perhitungan HST dan Fase Pertumbuhan Tanaman
    let hst = 0;
    let growthPhaseName = 'Belum Ada Musim Aktif';
    let stageCategory: GrowthStageCategory = 'PRE_PLANTING';
    let daysToHarvest = 0;

    const matchedVariety = input.varieties?.find(
      (v) => v.name.toLowerCase().trim() === (season?.varietyName || '').toLowerCase().trim()
    );
    const durationDays = matchedVariety?.growthDurationDays || 120;

    if (season?.plantingDate) {
      const hstRes = calculateHST(season.plantingDate, targetDate);
      hst = hstRes.hst ?? 0;
      const phase = determineGrowthPhase(hst, durationDays);
      growthPhaseName = phase.label;
      stageCategory = phase.stageCategory;
      daysToHarvest = Math.max(0, durationDays - hst);
    }

    const activeLandName = land?.name || 'Petak Sawah Utama';
    const locationDisplayName = land?.location || land?.name || 'Lokasi Sentra Padi';

    const recommendations: AgriWeatherRecommendation[] = [];
    const alerts: { title: string; desc: string; severity: 'INFO' | 'WARNING' | 'DANGER' }[] = [];

    // Jika data cuaca belum ada, berikan panduan umum
    if (!weather || !weather.current) {
      return {
        hst,
        growthPhaseName,
        stageCategory,
        daysToHarvest,
        activeLandName,
        locationDisplayName,
        recommendations: [
          {
            id: 'rec-no-weather',
            category: 'GENERAL',
            categoryLabel: 'Umum',
            urgency: 'INFO',
            title: 'Pantau Kondisi Langit & Drainase Sawah Secara Visual',
            reason: 'Data prakiraan cuaca digital belum termuat atau perangkat sedang offline.',
            actionItem: 'Lakukan pengamatan visual terhadap awan dan arah angin sebelum pemupukan tabur atau penyemprotan.',
            cropContext: season ? `Umur ${hst} HST (${growthPhaseName})` : 'Belum ada musim tanam',
          },
        ],
        alerts: [],
        summary: 'Data cuaca belum termuat. Tetap amati kondisi lapang secara visual.',
      };
    }

    const current = weather.current;
    const daily = weather.daily || [];
    const todayForecast = daily[0] || null;
    const next3Days = daily.slice(0, 3);

    // Deteksi Kondisi Cuaca Kritis
    const hasHeavyRainSoon = next3Days.some(
      (d) => d.rainProbability >= 65 || (d.rainMm && d.rainMm >= 10) || d.conditionType === 'HEAVY_RAIN' || d.conditionType === 'THUNDERSTORM'
    );
    const hasHighWindSoon = next3Days.some((d) => (d.windSpeed || 0) >= 16);
    const isVeryHumid = current.humidity >= 82 || next3Days.some((d) => (d.humidity || 0) >= 85);
    const isProlongedDry = next3Days.every((d) => d.rainProbability < 25 && (!d.rainMm || d.rainMm < 1));

    // Riwayat Terakhir
    const lastFertActivity = activities.filter((a) => a.category === 'FERTILIZER').sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0];
    const lastSprayActivity = activities.filter((a) => a.category === 'OPT').sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0];
    const activeOptObs = optObs.slice(-3);

    // =========================================================================
    // 1. REKOMENDASI PEMUPUKAN (FERTILIZER)
    // =========================================================================
    if (season && (stageCategory === 'VEGETATIVE' || (stageCategory === 'GENERATIVE' && hst <= 55))) {
      if (hasHeavyRainSoon) {
        recommendations.push({
          id: 'rec-fert-heavy-rain',
          category: 'FERTILIZER',
          categoryLabel: 'Pemupukan Susulan',
          urgency: 'WARNING',
          title: 'Tunda Pemupukan Tabur 1–2 Hari (Hindari Risiko Limpasan Air)',
          reason: `Prakiraan menunjukkan potensi curah hujan signifikan (${todayForecast?.rainProbability || current.rainProbability}% peluang hujan) dalam 24–48 jam ke depan.`,
          actionItem: 'Tunda penaburan pupuk Urea/NPK sampai hujan mereda. Pastikan pematang sawah terkunci agar butiran pupuk yang sudah terlanjur ditabur tidak hanyut ke saluran pembuangan.',
          cropContext: `Tanaman umur ${hst} HST (${growthPhaseName})`,
          weatherContext: `Peluang hujan ${todayForecast?.rainProbability || current.rainProbability}%, potensi hujan lebat`,
        });
      } else if (current.rainProbability <= 35 && !hasHeavyRainSoon) {
        recommendations.push({
          id: 'rec-fert-ideal-weather',
          category: 'FERTILIZER',
          categoryLabel: 'Pemupukan Susulan',
          urgency: 'INFO',
          title: 'Kondisi Cuaca Kondusif untuk Aplikasi Pupuk',
          reason: `Cuaca diperkirakan stabil (${current.condition}, peluang hujan ${current.rainProbability}%) dengan angin relatif tenang.`,
          actionItem: 'Lakukan pemupukan susulan pada kondisi sawah macak-macak (tinggi air 1–2 cm) agar pupuk cepat larut dan diserap perakaran secara optimal tanpa terbuang.',
          cropContext: `Tanaman umur ${hst} HST (${growthPhaseName})`,
          weatherContext: `Cuaca ${current.condition}, angin ${current.windSpeed} km/j`,
        });
      }
    }

    // =========================================================================
    // 2. REKOMENDASI PENYEMPROTAN & PESTISIDA (SPRAYING)
    // =========================================================================
    if (current.rainProbability >= 60 || current.conditionType === 'MODERATE_RAIN' || current.conditionType === 'HEAVY_RAIN') {
      recommendations.push({
        id: 'rec-spray-rain-imminent',
        category: 'SPRAYING',
        categoryLabel: 'Penyemprotan Tanaman',
        urgency: 'WARNING',
        title: 'Hindari Penyemprotan Saat Ini (Pestisida Berisiko Tercuci Hujan)',
        reason: 'Pestisida dan agens hayati membutuhkan waktu lekat (rainfastness) minimal 3–5 jam agar meresap ke jaringan daun.',
        actionItem: 'Tunda penyemprotan herbisida/insektisida/fungisida sampai kondisi cuaca kering dan cerah berawan.',
        cropContext: season ? `Umur ${hst} HST` : undefined,
        weatherContext: `Peluang hujan tinggi (${current.rainProbability}%)`,
      });
    } else if (hasHighWindSoon || current.windSpeed >= 15) {
      recommendations.push({
        id: 'rec-spray-high-wind',
        category: 'SPRAYING',
        categoryLabel: 'Penyemprotan Tanaman',
        urgency: 'WARNING',
        title: 'Waspada Angin Kencang (Risiko Drift / Kabut Semprot Melenceng)',
        reason: `Kecepatan angin mencapai ${current.windSpeed} km/jam dapat menerbangkan butiran semprot keluar dari bidang sasaran tanaman.`,
        actionItem: 'Lakukan penyemprotan pada pagi hari (pukul 06.30–09.00) saat hembusan angin biasanya lebih tenang dan gunakan nozel berbutir halus-sedang.',
        weatherContext: `Kecepatan angin ${current.windSpeed} km/j dari arah ${todayForecast?.windDirection || 'Timur'}`,
      });
    } else if (current.rainProbability < 40 && current.windSpeed < 12) {
      recommendations.push({
        id: 'rec-spray-optimal',
        category: 'SPRAYING',
        categoryLabel: 'Penyemprotan Tanaman',
        urgency: 'INFO',
        title: 'Jendela Waktu Penyemprotan Prima (Pagi / Sore)',
        reason: 'Kecepatan angin tenang dan risiko hujan rendah dalam 6 jam ke depan.',
        actionItem: 'Waktu ideal untuk aplikasi agens hayati (seperti Beauveria/Trichoderma) atau pupuk daun. Semprotkan secara merata pada stomata daun bawah.',
        weatherContext: `Angin tenang (${current.windSpeed} km/j), peluang hujan rendah (${current.rainProbability}%)`,
      });
    }

    // =========================================================================
    // 3. REKOMENDASI TATA AIR & PENGAIRAN (WATER)
    // =========================================================================
    if (hasHeavyRainSoon) {
      recommendations.push({
        id: 'rec-water-drainage',
        category: 'WATER',
        categoryLabel: 'Tata Air & Saluran Sawah',
        urgency: 'WARNING',
        title: 'Periksa & Bersihkan Pintu Pelimpas (Drainase) Pematang',
        reason: 'Akumulasi curah hujan tinggi berpotensi menaikkan genangan air sawah melampaui ambang batas ideal.',
        actionItem: 'Buka sedikit pintu air keluar (spillway) agar tinggi genangan air di petak sawah tetap terjaga 2–3 cm, mencegah bibit muda tenggelam atau tanaman rebah.',
        cropContext: season ? `Fase ${growthPhaseName}` : undefined,
        weatherContext: 'Prakiraan curah hujan tinggi beberapa hari ke depan',
      });
    } else if (isProlongedDry) {
      recommendations.push({
        id: 'rec-water-dry-intermittent',
        category: 'WATER',
        categoryLabel: 'Tata Air & Pengairan',
        urgency: 'INFO',
        title: 'Terapkan Pengairan Berselang (Intermittent / Macak-macak)',
        reason: 'Prakiraan cuaca minim hujan. Pengelolaan air efisien diperlukan untuk menjaga kelembapan perakaran tanpa pemborosan.',
        actionItem: 'Genangi petak sawah setinggi 2–3 cm, lalu biarkan air meresap hingga tanah macak-macak (lembab berpori) selama 3–4 hari sebelum diairi kembali.',
        cropContext: season ? `Umur ${hst} HST (${growthPhaseName})` : undefined,
        weatherContext: 'Kecenderungan cuaca cerah & curah hujan minim',
      });
    }

    // =========================================================================
    // 4. REKOMENDASI OPT & KELEMBAPAN MIKROKLIMAT (OPT)
    // =========================================================================
    if (isVeryHumid) {
      recommendations.push({
        id: 'rec-opt-high-humidity',
        category: 'OPT',
        categoryLabel: 'Pengamatan Hama & Penyakit',
        urgency: 'WARNING',
        title: 'Tingkatkan Pengamatan Penyakit Jamur (Blas) & Bakteri (Kresek)',
        reason: `Kelembapan udara tinggi (${current.humidity}%) menciptakan mikroklimat kondusif bagi perkecambahan spora jamur Pyricularia oryzae (Blas) dan bakteri Xanthomonas oryzae.`,
        actionItem: 'Amati 10–20 rumpun sampel secara acak terutama pada daun bawah dan daun bendera. Hindari penggunaan pupuk Nitrogen (Urea) berlebih yang membuat jaringan tanaman sukulen.',
        cropContext: season ? `Fase ${growthPhaseName} (${hst} HST)` : undefined,
        weatherContext: `Kelembapan ${current.humidity}%`,
      });
    }

    // =========================================================================
    // 5. REKOMENDASI MENJELANG PANEN & PENGERINGAN GABAH (HARVEST)
    // =========================================================================
    if (season && (stageCategory === 'RIPENING' || hst >= durationDays - 15 || daysToHarvest <= 15)) {
      if (hasHeavyRainSoon) {
        recommendations.push({
          id: 'rec-harvest-rain-risk',
          category: 'HARVEST',
          categoryLabel: 'Panen & Pascapanen',
          urgency: 'ALERT',
          title: 'Waspada Risiko Hujan Saat Panen & Penjemuran Gabah',
          reason: `Tanaman sudah mendekati waktu panen (${daysToHarvest} hari lagi) dan prakiraan cuaca menunjukkan potensi hujan tinggi.`,
          actionItem: 'Siapkan terpal pelindung lapangan saat perontokan gabah. Hindari menimbun gabah basah lebih dari 24 jam tanpa dihamparkan untuk mencegah gabah berkecambah (kuning/rusak).',
          cropContext: `Tanaman umur ${hst} HST (Siap Panen ~${daysToHarvest} hari lagi)`,
          weatherContext: 'Potensi hujan lebat saat periode pematangan akhir',
        });
        alerts.push({
          title: 'Peringatan Panen di Musim Hujan',
          desc: 'Segera atur jadwal tenaga perontok pada jeda waktu terang dan siapkan alas jemur beralas terpal.',
          severity: 'WARNING',
        });
      } else {
        recommendations.push({
          id: 'rec-harvest-sunny-window',
          category: 'HARVEST',
          categoryLabel: 'Panen & Pascapanen',
          urgency: 'INFO',
          title: 'Kondisi Cuaca Sangat Baik untuk Pematangan Bulir & Penjemuran',
          reason: `Cuaca dominan cerah terik (${Math.round(current.temperature)}°C) mempercepat proses pengisian bulir dan pengeringan alami gabah di lapang.`,
          actionItem: 'Lakukan pengeringan gabah di bawah sinar matahari langsung dengan tebal hamparan 3–5 cm dan pembalikan tiap 2 jam hingga kadar air mencapai 14% GKG.',
          cropContext: `Fase ${growthPhaseName} (~${daysToHarvest} hari menjelang panen)`,
          weatherContext: `Cerah (${Math.round(current.temperature)}°C)`,
        });
      }
    }

    // Fallback rekomendasi jika belum ada yang terpilih
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'rec-general-monitoring',
        category: 'GENERAL',
        categoryLabel: 'Umum Lapang',
        urgency: 'INFO',
        title: 'Kondisi Lapangan Terpantau Terkendali',
        reason: 'Tidak terdeteksi anomali cuaca ekstrem dalam 48 jam ke depan.',
        actionItem: 'Lanjutkan kegiatan pemeliharaan tanaman, penyiangan gulma, dan pengamatan rutin mingguan sesuai jadwal pola tanam.',
        cropContext: season ? `Umur ${hst} HST (${growthPhaseName})` : undefined,
        weatherContext: `${current.condition}, ${Math.round(current.temperature)}°C`,
      });
    }

    // Ringkasan kalimat bijak
    const summary = hasHeavyRainSoon
      ? 'Kondisi cuaca menunjukkan potensi curah hujan tinggi. Prioritaskan kelancaran drainase dan tunda pemupukan tabur atau penyemprotan sampai cuaca stabil.'
      : isVeryHumid
      ? 'Kelembapan udara cukup tinggi. Disarankan meningkatkan pemantauan gejala penyakit blas/kresek dan menjaga sirkulasi udara antar rumpun.'
      : 'Cuaca relatif bersahabat untuk kelanjutan aktivitas lapangan, pemupukan susulan, dan perawatan tanaman.';

    return {
      hst,
      growthPhaseName,
      stageCategory,
      daysToHarvest,
      activeLandName,
      locationDisplayName,
      recommendations,
      alerts,
      summary,
    };
  }
}
