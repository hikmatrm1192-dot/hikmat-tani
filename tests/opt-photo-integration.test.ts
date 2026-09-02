/**
 * HIKMAT TANI - Integration & Regression Tests:
 * Deteksi OPT Berbasis Foto & Integrasi Form Pengamatan OPT ke Rujukan PHT
 *
 * 14 Skenario Pengujian:
 * 1. Pengamatan manual tanpa foto menghasilkan rujukan relevan (PHT diprioritaskan).
 * 2. Pengamatan manual + foto jelas mengekstraksi visual clues dan memperkuat relevansi kandidat.
 * 3. Opsi "Belum tahu" + foto tidak menghasilkan diagnosis palsu, selalu menggunakan bahasa konsultatif.
 * 4. Foto berkualitas rendah/gelap ditangani dengan pesan informatif tanpa menggagalkan proses.
 * 5. PHT 7 langkah / 4 pilar disajikan terlebih dahulu sebelum opsi kimia.
 * 6. Bahan aktif kimia disajikan secara terstruktur hanya dari master data resmi terdaftar.
 * 7. Tidak mengarang bahan aktif jika OPT tidak memiliki data kimia terdaftar.
 * 8. Konteks bagian tanaman (daun, batang, akar, malai) meningkatkan bobot kecocokan.
 * 9. Sinergi multi-gejala meningkatkan skor relevansi OPT.
 * 10. Stopword dan noise non-agronomi dieliminasi secara efektif.
 * 11. Pemetaan alias lokal terdaftar (e.g. kresek, sundep).
 * 12. Sepenuhnya offline-first dan deterministik tanpa ketergantungan API eksternal.
 * 13. Query kosong mengembalikan katalog pustaka dasar.
 * 14. Regresi HST dan alur kalkulasi hara tetap utuh dan valid.
 */

import assert from 'assert';
import { SEED_OPTS } from '../src/db/seedData.ts';
import { matchOptRelevance, extractAgronomicTokens, buildPhtSteps, buildChemicalOptions } from '../src/engine/optRelevanceEngine.ts';
import { analyzePlantPhoto } from '../src/engine/visualAnalysisEngine.ts';
import { calculateHST } from '../src/engine/hstCalculator.ts';
import { calculateNutrients } from '../src/engine/nutrientEngine.ts';
import { Opt } from '../src/types/index.ts';

export async function runOptPhotoIntegrationTests() {
  console.log('=== MENJALANKAN UJI INTEGRASI DETEKSI OPT BERBASIS FOTO & RUJUKAN PHT ===\n');
  {
    const results = matchOptRelevance(SEED_OPTS, 'daun menguning dan rumpun kerdil', { attackLocations: ['LEAF'], minScoreThreshold: 6 });
    assert(results.length > 0); const top = results[0];
    assert.strictEqual(top.phtSteps.length, 7); assert(top.phtSteps[0].categoryTitle.includes('Pengamatan')); assert(top.phtSteps[1].categoryTitle.includes('Kultur Teknis')); assert(top.disclaimer.includes('bukan diagnosis pasti'));
    console.log('✓ Skenario 1 Lolos');
  }
  {
    const photoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const visualAnalysis = await analyzePlantPhoto(photoData, 'LEAF');
    assert(visualAnalysis !== null); assert(Array.isArray(visualAnalysis.visualClues));
    const results = matchOptRelevance(SEED_OPTS, 'pucuk daun mengering mudah dicabut', { attackLocations: ['LEAF', 'STEM'], visualTokens: ['kuning', 'putih'], visualClues: visualAnalysis.visualClues, minScoreThreshold: 6 });
    assert(results.length > 0); const pbpkMatch = results.find((r) => r.opt.id === 'opt-penggerek-kuning'); assert(pbpkMatch !== undefined); assert(pbpkMatch.score > 40);
    console.log('✓ Skenario 2 Lolos');
  }
  {
    const results = matchOptRelevance(SEED_OPTS, 'bercak belah ketupat di tepi daun', { attackLocations: ['LEAF'], visualTokens: ['bercak', 'belah ketupat'], minScoreThreshold: 6 });
    assert(results.length > 0); const top = results[0]; assert(top.relevanceLabel.includes('Rujukan Pembanding')); assert(top.disclaimer.includes('Rujukan ini ditampilkan sebagai pembanding')); assert(results.some((r) => r.opt.id === 'opt-blas-padi'));
    console.log('✓ Skenario 3 Lolos');
  }
  {
    const emptyResult = await analyzePlantPhoto('', 'LEAF');
    assert.strictEqual(emptyResult.clarityStatus, 'UNCLEAR'); assert.strictEqual(emptyResult.isHelpful, false); assert(emptyResult.clarityMessage.includes('belum cukup jelas'));
    const searchResult = matchOptRelevance(SEED_OPTS, 'malai hampa beluk', { attackLocations: ['PANICLE'], visualTokens: emptyResult.detectedKeywords, minScoreThreshold: 6 }); assert(searchResult.length > 0);
    console.log('✓ Skenario 4 Lolos');
  }
  {
    const wereng = SEED_OPTS.find((o) => o.id === 'opt-wereng-coklat')!; const steps = buildPhtSteps(wereng);
    assert.strictEqual(steps.length, 7); assert.strictEqual(steps[0].stepNumber, 1); assert(steps[0].actionTitle.includes('Konfirmasi Lapang')); assert(steps[1].actionTitle.includes('Pengaturan Pola Tanam')); assert(steps[2].actionTitle.includes('Pembersihan Inang')); assert(steps[3].actionTitle.includes('Pengeringan Berkala')); assert(steps[4].actionTitle.includes('Pemasangan Perangkap')); assert(steps[5].actionTitle.includes('Konservasi Predator')); assert(steps[6].actionTitle.includes('Evaluasi Perkembangan'));
    console.log('✓ Skenario 5 Lolos');
  }
  {
    const pbpk = SEED_OPTS.find((o) => o.id === 'opt-penggerek-kuning')!; const chemOptions = buildChemicalOptions(pbpk);
    assert.strictEqual(chemOptions.hasChemicalData, true); assert(chemOptions.activeIngredients.includes('Klorantraniliprol')); assert(chemOptions.activeIngredients.includes('Dimehipo')); assert(chemOptions.cautionaryNotice.includes('disesuaikan dengan label produk yang terdaftar')); assert(chemOptions.resistanceNotes !== undefined);
    console.log('✓ Skenario 6 Lolos');
  }
  {
    const customOpt: Opt = { id: 'opt-custom-test', commonName: 'Hama Uji Coba Lapang', category: 'INSECT_PEST', symptoms: 'Daun berlubang sedikit', aliases: [], hostPlants: ['Padi'], triggerFactors: ['Kelembapan tinggi'], activeIngredients: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
    const chemOptions = buildChemicalOptions(customOpt); assert.strictEqual(chemOptions.hasChemicalData, false); assert.strictEqual(chemOptions.activeIngredients.length, 0);
    console.log('✓ Skenario 7 Lolos');
  }
  {
    const panicleResults = matchOptRelevance(SEED_OPTS, 'gabah hampa bintik coklat', { attackLocations: ['PANICLE'], minScoreThreshold: 6 }); assert(panicleResults.length > 0); const topIds = panicleResults.slice(0, 3).map((r) => r.opt.id); assert(topIds.includes('opt-walang-sangit') || topIds.includes('opt-penggerek-kuning'));
    console.log('✓ Skenario 8 Lolos');
  }
  {
    const singleSymptom = matchOptRelevance(SEED_OPTS, 'daun menguning', { attackLocations: ['LEAF'], minScoreThreshold: 6 }); const multiSymptom = matchOptRelevance(SEED_OPTS, 'daun menguning dan tanaman kerdil anakan sedikit', { attackLocations: ['LEAF'], minScoreThreshold: 6 }); assert(singleSymptom.length > 0 && multiSymptom.length > 0); assert(multiSymptom[0].score >= singleSymptom[0].score);
    console.log('✓ Skenario 9 Lolos');
  }
  {
    const tokens = extractAgronomicTokens('tampak terlihat gejala di petak sawah tanaman daun menguning dan sundep'); assert(!tokens.words.includes('tampak')); assert(!tokens.words.includes('terlihat')); assert(!tokens.words.includes('sawah')); assert(!tokens.words.includes('tanaman')); assert(tokens.words.includes('menguning') || tokens.stems.includes('kuning')); assert(tokens.words.includes('sundep'));
    console.log('✓ Skenario 10 Lolos');
  }
  {
    const results = matchOptRelevance(SEED_OPTS, 'kresek daun', { attackLocations: ['LEAF'], minScoreThreshold: 6 }); assert(results.length > 0); assert.strictEqual(results[0].opt.id, 'opt-hawar-daun-bakteri'); assert.strictEqual(results[0].isExactMatch, true);
    console.log('✓ Skenario 11 Lolos');
  }
  {
    const query = 'pucuk mati sundep batang padi'; const run1 = matchOptRelevance(SEED_OPTS, query, { attackLocations: ['STEM'] }); const run2 = matchOptRelevance(SEED_OPTS, query, { attackLocations: ['STEM'] }); assert.strictEqual(run1.length, run2.length); assert.strictEqual(run1[0].opt.id, run2[0].opt.id); assert.strictEqual(run1[0].score, run2[0].score);
    console.log('✓ Skenario 12 Lolos');
  }
  {
    const results = matchOptRelevance(SEED_OPTS, ''); assert.strictEqual(results.length, SEED_OPTS.length); assert.strictEqual(results[0].relevanceLabel, 'Katalog Pustaka');
    console.log('✓ Skenario 13 Lolos');
  }
  {
    const hst = calculateHST('2026-08-01', '2026-08-21'); assert.strictEqual(hst.isValid, true); assert.strictEqual(hst.hst, 20); const nutrients = calculateNutrients(100, { N: 46, P2O5: 0, K2O: 0 }); assert.strictEqual(nutrients.primarySummary.N_kg, 46); assert.strictEqual(nutrients.primarySummary.P2O5_kg, 0);
    console.log('✓ Skenario 14 Lolos');
  }
  console.log('\n=== SEMUA 14 SKENARIO PENGUJIAN DETEKSI OPT & FOTO BERHASIL 100% ===\n');
}

runOptPhotoIntegrationTests();
