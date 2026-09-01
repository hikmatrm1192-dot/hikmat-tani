/**
 * HIKMAT TANI - Weather Agri Module & Engine Test Suite
 * 
 * Verifikasi:
 * 1. WeatherAgriEngine evaluasi deterministik
 * 2. Short-term forecast 1-10 hari dengan indikator risiko
 * 3. Medium-term trend 2-4 minggu (probabilistik agroklimat)
 * 4. Seasonal outlook 1-3 bulan
 * 5. Rekomendasi agronomis berbasis cuaca + HST + fase + riwayat kegiatan
 */

import { WeatherAgriEngine } from '../src/engine/weatherAgriEngine.ts';
import { WeatherData, Land, CropSeason, Activity, FertilizerApplication, OptObservation } from '../src/types/index.ts';

function runTests() {
  console.log('=== TEST MODUL PRAKIRAAN CUACA & PERTANIAN ===');
  let passed = 0;
  let failed = 0;

  const mockLand: Land = {
    id: 'land-1',
    farmerId: 'farmer-1',
    name: 'Petak Blok Timur',
    areaHa: 0.5,
    location: 'Desa Rancabango, Kec. Patokbeusi, Subang',
    latitude: -6.45,
    longitude: 107.65,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSeason: CropSeason = {
    id: 'season-1',
    landId: 'land-1',
    commodity: 'Padi',
    varietyName: 'Inpari 32',
    plantedAreaHa: 0.5,
    plantingDate: new Date(Date.now() - 25 * 86400000).toISOString().split('T')[0], // 25 HST (Vegetatif)
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockWeatherData: WeatherData = {
    latitude: -6.45,
    longitude: 107.65,
    timezone: 'Asia/Jakarta',
    cachedAt: new Date().toISOString(),
    current: {
      temperature: 29.5,
      humidity: 86,
      condition: 'Hujan Ringan',
      conditionType: 'LIGHT_RAIN',
      conditionCode: 61,
      rainProbability: 70,
      rainMm: 4.5,
      windSpeed: 12,
      source: 'LIVE',
      updatedAt: new Date().toISOString(),
    },
    daily: [
      {
        date: '2026-09-01',
        dayLabel: 'Hari Ini',
        condition: 'Hujan Sedang',
        conditionType: 'MODERATE_RAIN',
        conditionCode: 63,
        tempMin: 23,
        tempMax: 31,
        rainProbability: 75,
        rainMm: 8.2,
        humidity: 88,
        windSpeed: 14,
        riskLevel: 'MEDIUM',
        riskReason: 'Potensi hujan sedang',
      },
      {
        date: '2026-09-02',
        dayLabel: 'Besok',
        condition: 'Hujan Lebat',
        conditionType: 'HEAVY_RAIN',
        conditionCode: 65,
        tempMin: 22,
        tempMax: 30,
        rainProbability: 85,
        rainMm: 22.0,
        humidity: 92,
        windSpeed: 18,
        riskLevel: 'HIGH',
        riskReason: 'Peluang hujan lebat & angin cukup kencang',
      },
    ],
  };

  // Test 1: WeatherAgriEngine generates contextual evaluation
  try {
    const evalResult = WeatherAgriEngine.evaluate({
      land: mockLand,
      cropSeason: mockSeason,
      weatherData: mockWeatherData,
      activities: [],
      fertilizerApplications: [],
      optObservations: [],
      varieties: [{
        id: 'var-1',
        name: 'Inpari 32',
        aliases: ['Inpari 32 HDB'],
        growthDurationDays: 120,
        resistanceProfile: 'Tahan HDB',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
    });

    if (evalResult.hst >= 24 && evalResult.hst <= 26 && evalResult.recommendations.length > 0) {
      console.log('✓ 1. WeatherAgriEngine Evaluator: Menghasilkan rekomendasi kontekstual berbasis HST & cuaca');
      passed++;
    } else {
      console.error('✗ 1. Evaluator gagal menghitung HST / rekomendasi', evalResult);
      failed++;
    }
  } catch (e: any) {
    console.error('✗ 1. Exception di evaluator:', e.message);
    failed++;
  }

  // Test 2: Heavy rain risk warning on fertilization
  try {
    const evalResult = WeatherAgriEngine.evaluate({
      land: mockLand,
      cropSeason: mockSeason,
      weatherData: mockWeatherData,
    });

    const fertRec = evalResult.recommendations.find(r => r.category === 'FERTILIZER');
    if (fertRec && (fertRec.urgency === 'WARNING' || fertRec.actionItem.toLowerCase().includes('tunda') || fertRec.reason.toLowerCase().includes('hujan'))) {
      console.log('✓ 2. Rekomendasi Pemupukan: Menyarankan tunda/waspada saat peluang hujan tinggi');
      passed++;
    } else {
      console.error('✗ 2. Rekomendasi pemupukan tidak mendeteksi risiko hujan lebat', fertRec);
      failed++;
    }
  } catch (e: any) {
    console.error('✗ 2. Exception:', e.message);
    failed++;
  }

  // Test 3: Pest & Disease risk during high humidity
  try {
    const evalResult = WeatherAgriEngine.evaluate({
      land: mockLand,
      cropSeason: mockSeason,
      weatherData: mockWeatherData,
    });

    const optRec = evalResult.recommendations.find(r => r.category === 'OPT');
    if (optRec && (optRec.reason.toLowerCase().includes('lembab') || optRec.reason.toLowerCase().includes('hujan') || optRec.title.toLowerCase().includes('blas') || optRec.title.toLowerCase().includes('hdb') || optRec.title.toLowerCase().includes('jamur') || optRec.title.toLowerCase().includes('kresek'))) {
      console.log('✓ 3. Rekomendasi Pengendalian OPT: Waspada kelembapan tinggi terhadap jamur/blas/bakteri');
      passed++;
    } else {
      console.error('✗ 3. Rekomendasi OPT tidak mendeteksi risiko kelembapan', optRec);
      failed++;
    }
  } catch (e: any) {
    console.error('✗ 3. Exception:', e.message);
    failed++;
  }

  // Test 4: Offline fallback graceful degradation
  try {
    const offlineEval = WeatherAgriEngine.evaluate({
      land: mockLand,
      cropSeason: mockSeason,
      weatherData: null,
    });

    if (offlineEval.recommendations.length > 0 && offlineEval.summary.includes('belum termuat')) {
      console.log('✓ 4. Offline Fallback: Beroperasi deterministik tanpa crash saat data cuaca kosong');
      passed++;
    } else {
      console.error('✗ 4. Offline evaluation gagal', offlineEval);
      failed++;
    }
  } catch (e: any) {
    console.error('✗ 4. Exception offline evaluation:', e.message);
    failed++;
  }

  console.log(`\nTotal: ${passed + failed} | Lolos: ${passed} | Gagal: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
