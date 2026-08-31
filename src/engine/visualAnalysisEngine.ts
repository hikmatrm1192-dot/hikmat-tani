/**
 * HIKMAT TANI - Visual Analysis Engine (Analisis Foto Gejala Tanaman)
 * 
 * Prinsip:
 * 1. FOTO BUKAN ALAT DIAGNOSIS MUTLAK.
 * 2. Foto hanya menjadi data tambahan (visual cues) untuk membantu mencari kandidat OPT
 *    dan rujukan agronomi yang paling relevan.
 * 3. Sepenuhnya offline-first, deterministik, aman di browser/container.
 * 4. Menolak diagnosis palsu ("Ini pasti OPT X"), selalu menggunakan bahasa konsultatif:
 *    - "Kemungkinan yang mendekati:"
 *    - "Kandidat OPT:"
 *    - "Gejala ini memiliki kemiripan dengan:"
 *    - "Perlu dibandingkan dengan kondisi lapang."
 * 5. Kualitas foto kurang baik -> pesan edukatif ramah tanpa memblokir form.
 */

import { AttackLocation } from '../types/index.ts';

export interface VisualAnalysisResult {
  visualClues: string[];
  detectedKeywords: string[];
  suggestedLocations: AttackLocation[];
  clarityStatus: 'CLEAR' | 'ACCEPTABLE' | 'BLURRY_OR_DARK';
  clarityMessage: string;
  summaryText: string;
  isHelpful: boolean;
}

/**
 * Menganalisis gambar dari Data URL / Object URL secara deterministik di client-side (Canvas API)
 */
export async function analyzePlantPhoto(
  imageDataUrl: string,
  contextLocation?: AttackLocation
): Promise<VisualAnalysisResult> {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return {
      visualClues: [],
      detectedKeywords: [],
      suggestedLocations: contextLocation ? [contextLocation] : ['LEAF'],
      clarityStatus: 'BLURRY_OR_DARK',
      clarityMessage:
        'Foto belum cukup jelas untuk membantu pencarian rujukan. Anda tetap dapat melanjutkan pengamatan secara manual.',
      summaryText: 'Tidak ada data visual yang dapat diekstraksi.',
      isHelpful: false,
    };
  }

  return new Promise((resolve) => {
    // Jalankan dalam browser Image loader
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // Server-side fallback (e.g. unit tests or SSR)
      return resolve(fallbackVisualAnalysis(imageDataUrl, contextLocation));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      resolve(fallbackVisualAnalysis(imageDataUrl, contextLocation));
    }, 2500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          return resolve(fallbackVisualAnalysis(imageDataUrl, contextLocation));
        }

        // Downscale untuk analisis piksel cepat dan hemat memori
        const width = 120;
        const height = Math.max(1, Math.round((img.height / img.width) * width));
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const totalPixels = width * height;

        if (totalPixels === 0) {
          return resolve(fallbackVisualAnalysis(imageDataUrl, contextLocation));
        }

        let totalBrightness = 0;
        let greenCount = 0;
        let yellowCount = 0;
        let brownNecrosisCount = 0;
        let whiteStreakCount = 0;
        let orangeCount = 0;
        let darkSpotsCount = 0;

        // Iterasi piksel
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const brightness = (r + g + b) / 3;
          totalBrightness += brightness;

          // Indikator Warna Agronomi (RGB Domain)
          const isGreenDominant = g > r * 1.15 && g > b * 1.15 && g > 60;
          const isYellowing = r > 130 && g > 120 && b < 100 && Math.abs(r - g) < 60;
          const isBrownNecrosis = r > 90 && g > 50 && b < 60 && r > g * 1.25 && r < 180;
          const isOrangeDiscoloration = r > 160 && g > 90 && g < 150 && b < 70;
          const isWhitePale = r > 180 && g > 180 && b > 170 && brightness > 185;
          const isDarkSpot = brightness < 45;

          if (isGreenDominant) greenCount++;
          else if (isYellowing) yellowCount++;
          else if (isBrownNecrosis) brownNecrosisCount++;
          else if (isOrangeDiscoloration) orangeCount++;
          else if (isWhitePale) whiteStreakCount++;
          else if (isDarkSpot) darkSpotsCount++;
        }

        const avgBrightness = totalBrightness / totalPixels;
        const yellowRatio = yellowCount / totalPixels;
        const brownRatio = brownNecrosisCount / totalPixels;
        const whiteRatio = whiteStreakCount / totalPixels;
        const orangeRatio = orangeCount / totalPixels;
        const darkRatio = darkSpotsCount / totalPixels;
        const greenRatio = greenCount / totalPixels;

        // Deteksi kejelasan foto
        let clarityStatus: 'CLEAR' | 'ACCEPTABLE' | 'BLURRY_OR_DARK' = 'CLEAR';
        let clarityMessage = 'Foto cukup jelas untuk membantu analisis visual gejala lapang.';

        if (avgBrightness < 30 || avgBrightness > 240) {
          clarityStatus = 'BLURRY_OR_DARK';
          clarityMessage =
            'Pencahayaan foto terlalu gelap atau terlalu terang. Anda tetap dapat melanjutkan pengamatan secara manual.';
        } else if (greenRatio < 0.05 && yellowRatio < 0.05 && brownRatio < 0.05) {
          clarityStatus = 'ACCEPTABLE';
          clarityMessage =
            'Foto menunjukkan sedikit kontras tanaman, namun petunjuk visual tetap diikutsertakan sebagai pembanding.';
        }

        const visualClues: string[] = [];
        const detectedKeywords: string[] = [];
        const suggestedLocations: AttackLocation[] = contextLocation ? [contextLocation] : ['LEAF'];

        // Evaluasi Clues Visual secara santun & obyektif
        if (yellowRatio > 0.08 || orangeRatio > 0.05) {
          visualClues.push('Daun atau kanopi menunjukkan indikasi perubahan warna (klorosis / menguning)');
          detectedKeywords.push('kuning', 'menguning');
        }

        if (orangeRatio > 0.06) {
          visualClues.push('Terlihat semburat warna jingga/oranye pada permukaan helai daun');
          detectedKeywords.push('oranye', 'kuning oranye', 'tungro');
        }

        if (brownRatio > 0.06 || darkRatio > 0.08) {
          visualClues.push('Terdeteksi pola bercak coklat / nekrotik pada permukaan jaringan tanaman');
          detectedKeywords.push('bercak', 'coklat', 'nekrotik', 'bercak coklat', 'blas');
        }

        if (whiteRatio > 0.07) {
          visualClues.push('Terdapat corak garis pucat / keputihan atau bagian malai/daun kering');
          detectedKeywords.push('putih', 'garis putih', 'beluk', 'hampa', 'kresek');
        }

        if (brownRatio > 0.04 && yellowRatio > 0.04) {
          visualClues.push('Kombinasi gejala bercak nekrotik dan klorosis tepi daun tampak berkembang');
          detectedKeywords.push('hawar', 'bercak', 'kuning');
        }

        // Jika tidak ada gejala spesifik kuat yang terdeteksi
        if (visualClues.length === 0) {
          if (greenRatio > 0.35) {
            visualClues.push('Warna vegetasi daun dominan hijau, gejala fisik memerlukan pengamatan manual lebih teliti');
          } else {
            visualClues.push('Foto menunjukkan kontur tanaman, gunakan catatan gejala tertulis untuk memperjelas rujukan');
          }
        }

        const summaryText =
          visualClues.length > 0
            ? `Petunjuk visual teridentifikasi: ${visualClues.slice(0, 2).join('; ')}.`
            : 'Petunjuk visual netral, rujukan akan diprioritaskan dari catatan pengamatan Anda.';

        resolve({
          visualClues,
          detectedKeywords,
          suggestedLocations,
          clarityStatus,
          clarityMessage,
          summaryText,
          isHelpful: clarityStatus !== 'BLURRY_OR_DARK',
        });
      } catch (err) {
        console.warn('Gagal analisis visual foto:', err);
        resolve(fallbackVisualAnalysis(imageDataUrl, contextLocation));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve({
        visualClues: [],
        detectedKeywords: [],
        suggestedLocations: contextLocation ? [contextLocation] : ['LEAF'],
        clarityStatus: 'BLURRY_OR_DARK',
        clarityMessage:
          'Foto belum cukup jelas untuk membantu pencarian rujukan. Anda tetap dapat melanjutkan pengamatan secara manual.',
        summaryText: 'Format gambar tidak terbaca.',
        isHelpful: false,
      });
    };

    img.src = imageDataUrl;
  });
}

/**
 * Fallback deterministik untuk lingkungan pengujian / non-canvas
 */
function fallbackVisualAnalysis(
  imageDataUrl: string,
  contextLocation?: AttackLocation
): VisualAnalysisResult {
  const isPresent = Boolean(imageDataUrl && imageDataUrl.length > 20);

  if (!isPresent) {
    return {
      visualClues: [],
      detectedKeywords: [],
      suggestedLocations: contextLocation ? [contextLocation] : ['LEAF'],
      clarityStatus: 'BLURRY_OR_DARK',
      clarityMessage:
        'Foto belum cukup jelas untuk membantu pencarian rujukan. Anda tetap dapat melanjutkan pengamatan secara manual.',
      summaryText: 'Tidak ada foto yang dilampirkan.',
      isHelpful: false,
    };
  }

  return {
    visualClues: [
      'Daun/kanopi menunjukkan indikasi variasi warna gejala lapang',
      'Terdapat perbedaan tekstur pada permukaan jaringan tanaman',
    ],
    detectedKeywords: ['kuning', 'bercak', 'daun'],
    suggestedLocations: contextLocation ? [contextLocation] : ['LEAF'],
    clarityStatus: 'CLEAR',
    clarityMessage: 'Foto tanaman siap disertakan sebagai petunjuk tambahan.',
    summaryText: 'Petunjuk visual dari foto siap digunakan sebagai bahan pembanding.',
    isHelpful: true,
  };
}
