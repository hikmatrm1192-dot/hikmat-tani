/**
 * HIKMAT TANI - Aggregated Field Knowledge & Anti-Reidentification Test Suite
 * 
 * Verifikasi:
 * 1. Pemisahan 3 Lapisan Data:
 *    - Layer A: FARMER PRIVATE DATA (Raw operational data)
 *    - Layer B: AGGREGATED FIELD KNOWLEDGE (Anonymized regional insights)
 *    - Layer C: GENERAL KNOWLEDGE (Master agronomy standards)
 * 2. K-Anonymity & Threshold Privasi (MIN_SAMPLE_THRESHOLD >= 5).
 * 3. Supresi Data Sampel Kecil: Tidak mengekspos kategori yang hanya dimiliki 1-2 petani.
 * 4. Zero-Private Identifier Guarantee: Output agregasi TIDAK PERNAH memuat NIK, nama, nomor HP, farmerId, atau koordinat.
 * 5. Agregasi multi-petani menghasilkan tren wilayah (Karawang Blas, Majalengka WBC).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { fieldKnowledgeService } from '../server/services/fieldKnowledgeService.ts';
import { knowledgeService } from '../server/services/knowledgeService.ts';

describe('HIKMAT TANI — Aggregated Field Knowledge & Privacy Test Suite', () => {
  beforeEach(() => {
    fieldKnowledgeService.resetStore();
  });

  describe('1. K-Anonymity & Anti-Reidentification (Threshold >= 5)', () => {
    it('harus mempublikasikan pola wilayah yang memiliki >= 5 sampel observasi (Karawang Blas & Majalengka WBC)', () => {
      const published = fieldKnowledgeService.getPublishedKnowledge();
      assert.strictEqual(published.success, true);
      assert.ok(published.publishedCount >= 2);

      // Cek agregasi Karawang (12 sampel)
      const karawangBlas = published.data.find((item) => item.regionRegency === 'Karawang');
      assert.ok(karawangBlas);
      assert.strictEqual(karawangBlas?.sampleCount, 12);
      assert.strictEqual(karawangBlas?.isPublished, true);
      assert.strictEqual(karawangBlas?.kAnonymityStatus, 'SUFFICIENT_SAMPLE');
      assert.ok(karawangBlas?.severityDistribution);
      assert.ok(karawangBlas?.insightSummary.includes('Karawang'));
      assert.ok(karawangBlas?.insightSummary.includes('12 catatan lapangan'));
    });

    it('harus MENYEMBUNYIKAN (suppress) data wilayah dengan < 5 sampel (Subang hanya 2 sampel)', () => {
      // By default getPublishedKnowledge() hanya mengembalikan isPublished: true
      const published = fieldKnowledgeService.getPublishedKnowledge();
      const subangInPublished = published.data.find((item) => item.regionRegency === 'Subang');
      assert.strictEqual(subangInPublished, undefined); // Subang TIDAK boleh muncul di feed publik!

      // Saat includeSuppressed diaktifkan (misal untuk audit internal), status harus INSUFFICIENT_SAMPLE_SUPPRESSED
      const all = fieldKnowledgeService.getPublishedKnowledge({ includeSuppressed: true });
      const subangItem = all.data.find((item) => item.regionRegency === 'Subang');
      assert.ok(subangItem);
      assert.strictEqual(subangItem?.sampleCount, 2);
      assert.strictEqual(subangItem?.isPublished, false);
      assert.strictEqual(subangItem?.kAnonymityStatus, 'INSUFFICIENT_SAMPLE_SUPPRESSED');
      assert.ok(subangItem?.insightSummary.includes('di bawah ambang batas privasi'));
      assert.strictEqual(subangItem?.severityDistribution, undefined); // Detail disembunyikan
    });

    it('ketika sampel di Subang bertambah menjadi >= 5, status otomatis berubah menjadi dipublikasikan', () => {
      // Tambah 3 observasi lagi ke Subang (total menjadi 5)
      for (let i = 3; i <= 5; i++) {
        fieldKnowledgeService.ingestObservation({
          farmerId: `farmer_sbg_${i}`,
          regency: 'Subang',
          district: 'Pagaden',
          commodity: 'Padi',
          varietyId: 'inpari-32',
          optId: 'opt-penggerek-batang',
          severity: 'SEDANG',
          hst: 20,
          growthStage: 'Vegetatif Awal',
          affectedAreaPercentage: 4,
        });
      }

      const published = fieldKnowledgeService.getPublishedKnowledge();
      const subangPublished = published.data.find((item) => item.regionRegency === 'Subang');
      assert.ok(subangPublished);
      assert.strictEqual(subangPublished?.sampleCount, 5);
      assert.strictEqual(subangPublished?.isPublished, true);
      assert.strictEqual(subangPublished?.kAnonymityStatus, 'SUFFICIENT_SAMPLE');
    });
  });

  describe('2. Zero-Private Identifier Guarantee', () => {
    it('output agregasi TIDAK PERNAH memuat NIK, nama petani, nomor HP, farmerId, atau koordinat GPS', () => {
      // Ingest observasi dengan data sensitif lengkap
      fieldKnowledgeService.ingestObservation({
        farmerId: 'farmer_private_secret_999',
        farmerName: 'Petani Budi Rahasia',
        nik: '3210010101999999',
        phoneNumber: '081299998888',
        latitude: -6.83921,
        longitude: 108.22312,
        regency: 'Majalengka',
        commodity: 'Padi',
        optId: 'opt-wereng-batang-coklat',
        severity: 'SEDANG',
      });

      const published = fieldKnowledgeService.getPublishedKnowledge();

      // Serialisasikan seluruh response agregasi ke JSON string
      const jsonString = JSON.stringify(published);

      // Verifikasi TIDAK ADA kebocoran data sensitif
      assert.strictEqual(jsonString.includes('farmer_private_secret_999'), false);
      assert.strictEqual(jsonString.includes('Petani Budi Rahasia'), false);
      assert.strictEqual(jsonString.includes('3210010101999999'), false);
      assert.strictEqual(jsonString.includes('081299998888'), false);
      assert.strictEqual(jsonString.includes('-6.83921'), false);
      assert.strictEqual(jsonString.includes('108.22312'), false);
    });
  });

  describe('3. Pemisahan 3 Lapisan Data Agronomi', () => {
    it('Layer B (Aggregated Field Knowledge) menyajikan pola statistik regional terverifikasi', () => {
      const insights = fieldKnowledgeService.getRegionalFieldInsights();
      assert.ok(insights.activeOutbreakAlerts.length >= 2);
      assert.ok(insights.anonymizationPolicy.includes('K-Anonymity terverifikasi'));
      assert.ok(insights.totalSamplesAnalyzed >= 22);
    });

    it('Layer C (General Agronomy Knowledge) tetap tersedia mandiri sebagai standar referensi BBPadi / Ditlin', () => {
      const bundle = knowledgeService.getKnowledgeBundle();
      assert.ok(bundle.fertilizers.length > 0);
      assert.ok(bundle.riceVarieties.length > 0);
      assert.ok(bundle.opts.length > 0);
      assert.ok(bundle.references.length > 0);
    });
  });
});
