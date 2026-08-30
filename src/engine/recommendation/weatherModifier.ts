/**
 * HIKMAT TANI - Weather Contextual Modifier
 * 
 * Prinsip Utama:
 * - CUACA BUKAN DECISION MAKER.
 * - Cuaca murni sebagai BAHAN REFERENSI, PEMBANDING, dan MODIFIER KONTEKSTUAL (timing & situasi lapang).
 * - Rekomendasi dasar agronomi (berdasarkan HST, fase pertumbuhan, varietas, hara, OPT) TETAP UTAMA.
 * - Tidak membatalkan rekomendasi, tidak mengubah dosis, tidak mengubah status menjadi CRITICAL.
 * - Pure logic tanpa side-effect I/O (network/storage).
 */

import { FieldWeatherContext } from '../../types/weather.ts';
import { FieldContext } from '../contextEngine.ts';
import { EvaluatedRecommendation } from './types.ts';

/**
 * Konfigurasi Ambang Batas Agronomi Ramah Petani untuk Pertimbangan Cuaca
 * Berdasarkan acuan standar penyuluhan pertanian BBPadi / Ditlin Kementan:
 * - Peluang hujan >= 60% atau curah hujan >= 5mm berisiko menimbulkan limpasan (leaching/runoff) pupuk.
 * - Kelembapan relatif >= 85% memicu mikroklimat kondusif bagi perkembangan spora jamur/bakteri (misal: Blas / Pyricularia oryzae, Hawar Daun Bakteri / Xanthomonas).
 * - Kecepatan angin >= 15 km/jam berisiko menyebabkan drift (penyimpangan arah) butir semprotan.
 */
export const WEATHER_AGRONOMIC_THRESHOLDS = {
  /** Peluang hujan signifikan untuk pertimbangan waktu aplikasi (%) */
  RAIN_PROBABILITY_SIGNIFICANT: 60,
  /** Curah hujan per waktu yang berpotensi menimbulkan limpasan permukaan (mm) */
  RAIN_MM_SIGNIFICANT: 5,
  /** Kelembapan tinggi pendukung mikroklimat penyakit jamur/bakteri (%) */
  HUMIDITY_HIGH: 85,
  /** Kecepatan angin yang berisiko memicu drift semprotan lapang (km/jam) */
  WIND_SPEED_DRIFT: 15,
};

/**
 * Memperkaya daftar rekomendasi agronomi dengan catatan pertimbangan cuaca (Weather Modifier).
 * 
 * Sifat:
 * - Jika weatherContext null/undefined/tidak tersedia: Mengembalikan rekomendasi asli tanpa perubahan.
 * - Jika source === 'FALLBACK': Hanya menyajikan catatan umum wilayah yang sangat berhati-hati.
 * - Jika source === 'CACHE' / 'LIVE': Menyajikan pertimbangan timing dan situasi lapang yang santun.
 */
export function enhanceRecommendationsWithWeather(
  recommendations: EvaluatedRecommendation[],
  weatherContext?: FieldWeatherContext | null,
  fieldContext?: FieldContext | null
): EvaluatedRecommendation[] {
  if (!weatherContext || !weatherContext.isAvailable) {
    return recommendations;
  }

  return recommendations.map((rec) => {
    const modifier = generateWeatherNote(rec, weatherContext, fieldContext);
    if (!modifier) {
      return rec;
    }

    return {
      ...rec,
      message: `${rec.message}\n\n${modifier}`,
      metadata: {
        ...rec.metadata,
        weatherModified: true,
        weatherSource: weatherContext.source,
      },
    };
  });
}

/**
 * Menghasilkan kalimat pertimbangan cuaca santun berdasarkan konteks rekomendasi dan data cuaca lapang.
 */
function generateWeatherNote(
  rec: EvaluatedRecommendation,
  weather: FieldWeatherContext,
  fieldContext?: FieldContext | null
): string | null {
  const isFallback = weather.source === 'FALLBACK';
  const isCache = weather.source === 'CACHE';

  const isRainLikely =
    weather.hasHeavyRainForecast ||
    weather.rainProbability >= WEATHER_AGRONOMIC_THRESHOLDS.RAIN_PROBABILITY_SIGNIFICANT ||
    weather.rainMm >= WEATHER_AGRONOMIC_THRESHOLDS.RAIN_MM_SIGNIFICANT ||
    weather.conditionType === 'HEAVY_RAIN' ||
    weather.conditionType === 'THUNDERSTORM' ||
    weather.conditionType === 'MODERATE_RAIN' ||
    weather.conditionType === 'LIGHT_RAIN';

  const isHighHumidity = weather.humidity >= WEATHER_AGRONOMIC_THRESHOLDS.HUMIDITY_HIGH;
  const isWindy = weather.windSpeed >= WEATHER_AGRONOMIC_THRESHOLDS.WIND_SPEED_DRIFT;

  // 1. Rekomendasi Terkait Pemupukan (FERTILIZER)
  if (rec.contextType === 'FERTILIZER') {
    if (isFallback) {
      return 'Pertimbangan umum perkiraan wilayah:\nSebagai referensi prakiraan cuaca wilayah, disarankan memperhatikan kondisi langit dan drainase petak sawah sebelum menentukan waktu pemupukan susulan agar pupuk dapat terserap optimal.';
    }

    if (isRainLikely) {
      const sourcePrefix = isCache ? ' (catatan perkiraan tersimpan)' : '';
      return `Pertimbangan cuaca${sourcePrefix}:\nPrakiraan menunjukkan peluang hujan cukup tinggi (${weather.rainProbability}%). Disarankan mempertimbangkan memilih waktu aplikasi ketika kondisi cuaca lebih stabil agar pupuk tidak mudah terbawa limpasan air.`;
    }

    return null;
  }

  // 2. Rekomendasi Terkait Pengamatan & Pengendalian OPT (OPT_CONTROL)
  if (rec.contextType === 'OPT_CONTROL') {
    if (isFallback) {
      if (isHighHumidity) {
        return 'Pertimbangan umum lapang:\nPerkiraan umum wilayah menunjukkan kondisi kelembapan cukup tinggi. Disarankan tetap memprioritaskan pengamatan rutin mingguan pada petak sawah dan memeriksa keberadaan musuh alami.';
      }
      return null;
    }

    const notes: string[] = [];
    const sourcePrefix = isCache ? ' (catatan perkiraan tersimpan)' : '';

    if (isHighHumidity) {
      notes.push(
        `Pertimbangan lapang${sourcePrefix}:\nKelembapan udara cukup tinggi (${weather.humidity}%). Kondisi lembap dapat mendukung perkembangan beberapa penyakit tanaman. Disarankan meningkatkan pengamatan pada rumpun sampel lain dan memantau perkembangan gejala secara berkala sesuai prinsip PHT.`
      );
    }

    if (isRainLikely || isWindy) {
      const conditionDesc = isWindy && isRainLikely ? 'hujan dan angin cukup kencang' : isWindy ? 'angin cukup kencang' : 'potensi hujan';
      notes.push(
        `Pertimbangan cuaca${sourcePrefix}:\nKondisi cuaca diperkirakan ${conditionDesc}. Jika ada rencana tindakan lapang, dapat dipertimbangkan memilih waktu aplikasi saat cuaca lebih tenang dan daun tidak terlalu basah agar efektivitas tindakan lebih optimal.`
      );
    }

    return notes.length > 0 ? notes.join('\n\n') : null;
  }

  // 3. Rekomendasi Terkait Fase Pertumbuhan Tanaman (GROWTH_STAGE)
  if (rec.contextType === 'GROWTH_STAGE') {
    const stageCategory = fieldContext?.growthPhase.stageCategory;
    const phaseCode = fieldContext?.growthPhase.phaseCode;

    // Fase Pematangan / Siap Panen
    if (stageCategory === 'RIPENING' || phaseCode === 'RIPENING_MATURE_HARVEST' || phaseCode === 'POST_HARVEST_OVERDUE') {
      if (isFallback) {
        return 'Pertimbangan umum cuaca:\nSebagai referensi perkiraan wilayah, disarankan memantau kondisi cuaca setempat untuk merencanakan waktu panen dan penjemuran gabah yang optimal.';
      }

      if (isRainLikely) {
        const sourcePrefix = isCache ? ' (catatan perkiraan tersimpan)' : '';
        return `Pertimbangan cuaca${sourcePrefix}:\nPrakiraan menunjukkan potensi hujan. Disarankan memantau kondisi cuaca lapang sebelum pelaksanaan panen dan menyiapkan terpal pelindung gabah saat perontokan atau penjemuran.`;
      }

      if (weather.conditionType === 'CLEAR' || weather.conditionType === 'PARTLY_CLOUDY') {
        const sourcePrefix = isCache ? ' (catatan perkiraan tersimpan)' : '';
        return `Pertimbangan cuaca${sourcePrefix}:\nKondisi cuaca diperkirakan cerah berawan, mendukung kelancaran proses pematangan bulir serta persiapan panen dan pengeringan gabah.`;
      }
    }

    // Fase Vegetatif / Pembentukan Anakan: Tata Air & Drainase saat Hujan Lebat
    if (weather.hasHeavyRainForecast || weather.conditionType === 'HEAVY_RAIN' || weather.conditionType === 'THUNDERSTORM') {
      if (!isFallback) {
        const sourcePrefix = isCache ? ' (catatan perkiraan tersimpan)' : '';
        return `Pertimbangan cuaca & tata air${sourcePrefix}:\nPrakiraan cuaca mengindikasikan potensi hujan lebat. Disarankan memeriksa kelancaran saluran pembuangan/drainase petak sawah agar tinggi genangan air tetap sesuai dengan kebutuhan fase tanaman.`;
      }
    }

    return null;
  }

  // 4. Rekomendasi Terkait Pengairan (WATER_MANAGEMENT)
  if (rec.contextType === 'WATER_MANAGEMENT') {
    if (isFallback) {
      return 'Pertimbangan umum tata air:\nSebagai referensi perkiraan wilayah, pertimbangkan kondisi curah hujan aktual sebelum melakukan penggenangan atau pembuangan air sawah.';
    }

    if (isRainLikely) {
      const sourcePrefix = isCache ? ' (catatan perkiraan tersimpan)' : '';
      return `Pertimbangan cuaca${sourcePrefix}:\nPrakiraan menunjukkan potensi hujan. Disarankan mempertimbangkan curah hujan aktual sebelum pengairan tambahan dan memastikan saluran drainase berfungsi baik untuk menghindari genangan berlebih.`;
    }

    return null;
  }

  return null;
}
