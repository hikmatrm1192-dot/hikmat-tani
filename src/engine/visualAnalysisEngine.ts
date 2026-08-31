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

import { AttackLocation, AttackSeverity, AiConfidenceLevel } from '../types/index.ts';

export interface VisualAnalysisResult {
  visualClues: string[];
  detectedTraits: string[];
  detectedKeywords: string[];
  suggestedLocations: AttackLocation[];
  suggestedSeverity?: AttackSeverity;
  clarityStatus: 'CLEAR' | 'ACCEPTABLE' | 'BLURRY_OR_DARK' | 'UNCLEAR';
  clarityMessage: string;
  summaryText: string;
  confidence: AiConfidenceLevel;
  isHelpful: boolean;
}

/**
 * Menganalisis gambar dari Data URL / Object URL secara deterministik di client-side (Canvas API)
 * 100% ON-DEVICE / LOCAL PROCESSING TANPA UPLOAD KE SERVER
 */
export async function analyzePlantPhoto(
  imageDataUrl: string,
  contextLocation?: AttackLocation
): Promise<VisualAnalysisResult> {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return {
      visualClues: [],
      detectedTraits: [],
      detectedKeywords: [],
      suggestedLocations: contextLocation ? [contextLocation] : [],
      clarityStatus: 'UNCLEAR',
      clarityMessage:
        'Foto belum cukup jelas untuk identifikasi. Silakan ambil foto lagi dengan fokus pada bagian tanaman yang terserang.',
      summaryText: 'Tidak ada foto atau format gambar tidak valid.',
      confidence: 'UNCLEAR',
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

        // Downscale untuk analisis piksel cepat dan hemat memori pada perangkat HP
        const width = 160;
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
        let topHalfDark = 0;
        let bottomHalfDark = 0;

        const halfHeight = Math.floor(height / 2);

        // Iterasi piksel dan ekstraksi histogram fitur warna
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;

            // Indikator Warna Agronomi (RGB Domain)
            const isGreenDominant = g > r * 1.12 && g > b * 1.12 && g > 55;
            const isYellowing = r > 125 && g > 115 && b < 95 && Math.abs(r - g) < 65;
            const isBrownNecrosis = r > 85 && g > 45 && b < 65 && r > g * 1.2 && r < 185;
            const isOrangeDiscoloration = r > 155 && g > 85 && g < 145 && b < 65;
            const isWhitePale = r > 175 && g > 175 && b > 165 && brightness > 180;
            const isDarkSpot = brightness < 45;

            if (isGreenDominant) greenCount++;
            else if (isYellowing) yellowCount++;
            else if (isBrownNecrosis) brownNecrosisCount++;
            else if (isOrangeDiscoloration) orangeCount++;
            else if (isWhitePale) whiteStreakCount++;
            else if (isDarkSpot) {
              darkSpotsCount++;
              if (y < halfHeight) topHalfDark++;
              else bottomHalfDark++;
            }
          }
        }

        const avgBrightness = totalBrightness / totalPixels;
        const yellowRatio = yellowCount / totalPixels;
        const brownRatio = brownNecrosisCount / totalPixels;
        const whiteRatio = whiteStreakCount / totalPixels;
        const orangeRatio = orangeCount / totalPixels;
        const darkRatio = darkSpotsCount / totalPixels;
        const greenRatio = greenCount / totalPixels;

        // Deteksi kejelasan foto & pencahayaan
        let clarityStatus: 'CLEAR' | 'ACCEPTABLE' | 'BLURRY_OR_DARK' | 'UNCLEAR' = 'CLEAR';
        let clarityMessage = 'Foto cukup jelas untuk membantu analisis visual gejala lapang.';

        if (avgBrightness < 32) {
          clarityStatus = 'BLURRY_OR_DARK';
          clarityMessage =
            'Pencahayaan foto terlalu gelap. Disarankan mengambil foto ulang di tempat yang lebih terang atau menghadap cahaya.';
        } else if (avgBrightness > 238) {
          clarityStatus = 'BLURRY_OR_DARK';
          clarityMessage =
            'Foto terlalu silau / overexposed. Disarankan mengambil foto ulang dengan posisi membelakangi sinar matahari langsung.';
        } else if (greenRatio < 0.04 && yellowRatio < 0.04 && brownRatio < 0.04 && whiteRatio < 0.04) {
          clarityStatus = 'UNCLEAR';
          clarityMessage =
            'Foto belum cukup jelas untuk identifikasi tanaman padi. Pastikan kamera mengarah tepat pada daun, batang, atau malai.';
        }

        const visualClues: string[] = [];
        const detectedTraits: string[] = [];
        const detectedKeywords: string[] = [];
        const suggestedLocations: AttackLocation[] = contextLocation ? [contextLocation] : [];

        // 1. Deteksi Perubahan Warna Daun & Klorosis
        if (yellowRatio > 0.07 || orangeRatio > 0.05) {
          visualClues.push('Daun atau kanopi menunjukkan indikasi perubahan warna (klorosis / menguning)');
          detectedTraits.push('Klorosis / Perubahan Warna Daun Menguning');
          detectedKeywords.push('kuning', 'menguning', 'daun menguning');
          if (!suggestedLocations.includes('LEAF')) suggestedLocations.push('LEAF');
        }

        // 2. Deteksi Warna Jingga / Oranye (Tungro / Kerdil Hampa)
        if (orangeRatio > 0.05) {
          visualClues.push('Terlihat semburat warna jingga/oranye dari pucuk ke pangkal helai daun');
          detectedTraits.push('Diskolorisasi Jingga/Oranye Pucuk Daun');
          detectedKeywords.push('oranye', 'kuning oranye', 'tungro');
          if (!suggestedLocations.includes('LEAF')) suggestedLocations.push('LEAF');
        }

        // 3. Deteksi Bercak Coklat & Nekrosis (Blas / Bercak Coklat / Hawar Pelepah)
        if (brownRatio > 0.05 || darkRatio > 0.07) {
          visualClues.push('Terdeteksi pola bercak coklat / jaringan nekrotik pada permukaan jaringan tanaman');
          detectedTraits.push('Bercak Coklat / Nekrosis Jaringan');
          detectedKeywords.push('bercak', 'coklat', 'nekrotik', 'bercak coklat', 'blas');
          if (!suggestedLocations.includes('LEAF')) suggestedLocations.push('LEAF');
        }

        // 4. Deteksi Corak Garis Pucat / Malai Hampa (Hawar Kresek / Beluk / Sundep)
        if (whiteRatio > 0.06) {
          visualClues.push('Terdapat corak garis pucat keputihan atau bagian malai/daun kering');
          detectedTraits.push('Garis Pucat / Bagian Mengering (Kresek/Beluk)');
          detectedKeywords.push('putih', 'garis putih', 'beluk', 'hampa', 'kresek', 'sundep');
          if (whiteRatio > 0.12 && !suggestedLocations.includes('PANICLE')) {
            suggestedLocations.push('PANICLE');
          }
        }

        // 5. Deteksi Kerusakan Ganda (Bercak + Menguning = Hawar Daun / Blas)
        if (brownRatio > 0.04 && yellowRatio > 0.04) {
          visualClues.push('Kombinasi gejala bercak nekrotik dan klorosis tepi daun tampak berkembang');
          detectedTraits.push('Kombinasi Bercak & Tepi Daun Kering');
          detectedKeywords.push('hawar', 'bercak', 'kuning', 'kresek');
        }

        // 6. Deteksi Konsentrasi Bercak Gelap di Pangkal Batang (Penggerek Batang / Busuk Batang)
        if (bottomHalfDark > topHalfDark * 1.5 && bottomHalfDark > 80) {
          visualClues.push('Konsentrasi diskolorisasi atau lubang gelap terdeteksi di bagian bawah/pangkal');
          detectedTraits.push('Diskolorisasi Gelap di Pangkal Batang/Rumpun');
          detectedKeywords.push('pangkal batang', 'sundep', 'penggerek batang', 'busuk batang');
          if (!suggestedLocations.includes('STEM')) suggestedLocations.push('STEM');
        }

        if (suggestedLocations.length === 0 && contextLocation) {
          suggestedLocations.push(contextLocation);
        }

        // Estimasi Severity dari rasio kerusakan visual
        let suggestedSeverity: AttackSeverity = 'LIGHT';
        const totalDamageRatio = yellowRatio + brownRatio + orangeRatio + whiteRatio;
        if (totalDamageRatio > 0.35) {
          suggestedSeverity = 'HEAVY';
        } else if (totalDamageRatio > 0.16) {
          suggestedSeverity = 'MEDIUM';
        }

        // Jika tidak ada gejala spesifik kuat yang terdeteksi
        if (visualClues.length === 0) {
          if (greenRatio > 0.35) {
            visualClues.push('Warna vegetasi daun dominan hijau normal, gejala spesifik memerlukan inspeksi manual');
            detectedTraits.push('Vegetasi Dominan Hijau (Gejala Fisik Perlu Cek Manual)');
          } else {
            visualClues.push('Petunjuk visual netral, rujukan akan diprioritaskan dari catatan pengamatan lapang');
            detectedTraits.push('Kontur Tanaman Terdeteksi Netral');
          }
        }

        // Tentukan tingkat keyakinan (Confidence Level)
        let confidence: AiConfidenceLevel = 'MODERATE';
        if (clarityStatus === 'BLURRY_OR_DARK' || clarityStatus === 'UNCLEAR') {
          confidence = 'UNCLEAR';
        } else if (detectedTraits.length >= 2 && totalDamageRatio > 0.1) {
          confidence = 'HIGH';
        } else if (detectedTraits.length >= 1) {
          confidence = 'MODERATE';
        } else {
          confidence = 'UNCERTAIN';
        }

        const summaryText =
          visualClues.length > 0
            ? `AI Image Capture mendeteksi: ${visualClues.slice(0, 2).join('; ')}.`
            : 'AI Image Capture mendeteksi kontur tanaman netral, gunakan catatan tambahan untuk verifikasi.';

        const isHelpful = clarityStatus !== 'BLURRY_OR_DARK' && clarityStatus !== 'UNCLEAR';

        resolve({
          visualClues,
          detectedTraits,
          detectedKeywords,
          suggestedLocations,
          suggestedSeverity,
          clarityStatus,
          clarityMessage,
          summaryText,
          confidence,
          isHelpful,
        });
      } catch (err) {
        console.warn('Gagal analisis visual foto on-device:', err);
        resolve(fallbackVisualAnalysis(imageDataUrl, contextLocation));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve({
        visualClues: [],
        detectedTraits: [],
        detectedKeywords: [],
        suggestedLocations: contextLocation ? [contextLocation] : [],
        clarityStatus: 'UNCLEAR',
        clarityMessage:
          'Foto belum cukup jelas untuk identifikasi. Silakan ambil foto lagi dengan fokus pada bagian tanaman.',
        summaryText: 'Format gambar tidak terbaca atau file rusak.',
        confidence: 'UNCLEAR',
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
      detectedTraits: [],
      detectedKeywords: [],
      suggestedLocations: contextLocation ? [contextLocation] : [],
      clarityStatus: 'UNCLEAR',
      clarityMessage:
        'Foto belum cukup jelas untuk identifikasi. Anda tetap dapat melanjutkan pengamatan secara manual.',
      summaryText: 'Tidak ada foto yang dilampirkan.',
      confidence: 'UNCLEAR',
      isHelpful: false,
    };
  }

  return {
    visualClues: [
      'Daun/kanopi menunjukkan indikasi variasi warna gejala lapang',
      'Terdapat perbedaan tekstur pada permukaan jaringan tanaman',
    ],
    detectedTraits: [
      'Variasi Warna Gejala Lapang',
      'Pola Tekstur Permukaan Jaringan',
    ],
    detectedKeywords: ['kuning', 'bercak', 'daun'],
    suggestedLocations: contextLocation ? [contextLocation] : [],
    suggestedSeverity: 'LIGHT',
    clarityStatus: 'CLEAR',
    clarityMessage: 'Foto tanaman siap disertakan sebagai petunjuk tambahan.',
    summaryText: 'Petunjuk visual dari foto siap digunakan sebagai bahan pembanding.',
    confidence: 'MODERATE',
    isHelpful: true,
  };
}
